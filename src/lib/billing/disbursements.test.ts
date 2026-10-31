import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  const client = new PGlite();
  return { db: drizzle(client, { schema }), client };
});
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import {
  recordDisbursement,
  cancelDisbursement,
  type DisbursementInput,
} from "./disbursements";
import {
  saveStandaloneCost,
  includeStandaloneCost,
  detachStandaloneCost,
  setStandaloneCostDeleted,
  makeExpenseStandalone,
} from "./standalone-expenses";
import { correctExpense, removePeriod, correctReceipt } from "./corrections";
import { loadSettlementData, insertUnitPayment } from "./settlement-store";
import { buildTreasury } from "./treasury";
import { getFinanceData, dashboardData } from "@/lib/queries/finance";
import { finalizeBillingPeriod } from "./finalize";

beforeAll(async () => {
  const { client } = (await import("@/lib/db")) as unknown as {
    client: import("@electric-sql/pglite").PGlite;
  };
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle/postgresql" });
});
afterAll(async () => {
  const { client } = (await import("@/lib/db")) as unknown as {
    client: import("@electric-sql/pglite").PGlite;
  };
  await client.close();
});

async function fixture() {
  const buildingId = crypto.randomUUID(),
    unitId = crypto.randomUUID(),
    categoryId = crypto.randomUUID(),
    periodId = crypto.randomUUID();
  await db.insert(s.building).values({ id: buildingId, name: "حساب آزمایشی" });
  await db.insert(s.unit).values({
    id: unitId,
    buildingId,
    label: "۱",
    occupantCount: 2,
    status: "occupied",
  });
  await db.insert(s.expenseCategory).values({
    id: categoryId,
    buildingId,
    name: "نظافت و لوازم",
    slug: "cleaning",
    allocationMethod: "per_unit",
  });
  await db.insert(s.billingPeriod).values({
    id: periodId,
    buildingId,
    title: "آبان",
    periodType: "monthly",
    startDate: new Date("2026-10-23"),
    endDate: new Date("2026-11-21"),
  });
  const standaloneExpenseId = await db.transaction((tx) =>
    saveStandaloneCost(tx, buildingId, {
      categoryId,
      amountRial: 39_000_000,
      description: "نظافت و خرید",
      expenseDate: new Date("2026-10-25"),
    }),
  );
  await db.transaction((tx) =>
    insertUnitPayment(
      tx,
      {
        unitId,
        amountRial: 50_000_000,
        paidAt: new Date("2026-10-25"),
        method: "bank_transfer",
      },
      buildingId,
    ),
  );
  const input = (
    overrides: Partial<DisbursementInput> = {},
  ): DisbursementInput => ({
    id: crypto.randomUUID(),
    standaloneExpenseId,
    amountRial: 35_000_000,
    payee: "نظافت‌چی",
    paidAt: new Date("2026-10-26"),
    method: "bank_transfer",
    items: [],
    finalPayment: true,
    ...overrides,
  });
  const pay = (value: DisbursementInput) =>
    db.transaction((tx) => recordDisbursement(tx, buildingId, value));
  const state = async () =>
    buildTreasury(
      await loadSettlementData(db, buildingId),
      await db
        .select()
        .from(s.expenseDisbursement)
        .where(eq(s.expenseDisbursement.buildingId, buildingId)),
    );
  return {
    buildingId,
    unitId,
    categoryId,
    periodId,
    standaloneExpenseId,
    input,
    pay,
    state,
  };
}

describe("actual fund payments", () => {
  it("converts a paid period expense to independent, preserving receipts, outlays and cash through another round trip", async () => {
    const f = await fixture();
    const expenseId = crypto.randomUUID();
    await db.insert(s.expenseLine).values({
      id: expenseId,
      periodId: f.periodId,
      categoryId: f.categoryId,
      description: "تجهیزات و لوازم",
      coverageMonths: 3,
      amountRial: 19_000_000,
      expenseDate: new Date("2026-10-25"),
    });
    await db.transaction((tx) =>
      insertUnitPayment(
        tx,
        {
          unitId: f.unitId,
          periodId: f.periodId,
          categoryId: f.categoryId,
          amountRial: 19_000_000,
          paidAt: new Date("2026-10-26"),
          method: "bank_transfer",
        },
        f.buildingId,
      ),
    );
    await f.pay(
      f.input({
        expenseId,
        standaloneExpenseId: undefined,
        amountRial: 14_644_000,
      }),
    );
    await finalizeBillingPeriod(f.periodId);
    const before = await f.state();
    const id = await db.transaction((tx) =>
      makeExpenseStandalone(tx, f.buildingId, expenseId),
    );
    const after = await f.state();
    expect(after.balanceRial).toBe(before.balanceRial);
    expect(after.paidRial).toBe(before.paidRial);
    expect(after.receivedRial).toBe(before.receivedRial);
    expect(
      after.costs.find((c) => c.target.standaloneExpenseId === id),
    ).toMatchObject({
      title: "تجهیزات و لوازم",
      periodId: null,
      settled: true,
      paidFromFundRial: 14_644_000,
    });
    expect(
      await db.query.billingPeriod.findFirst({
        where: eq(s.billingPeriod.id, f.periodId),
      }),
    ).toMatchObject({ status: "draft" });
    expect(
      await db.query.expenseLine.findFirst({
        where: eq(s.expenseLine.id, expenseId),
      }),
    ).toMatchObject({ sourceStandaloneId: id, deletedAt: expect.any(Date) });
    const held = (await loadSettlementData(db, f.buildingId)).payments.filter(
      (p) => p.standaloneExpenseId === id,
    );
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({
      amountRial: 19_000_000,
      periodId: null,
      categoryId: null,
    });
    await expect(
      db.transaction((tx) =>
        makeExpenseStandalone(tx, f.buildingId, expenseId),
      ),
    ).rejects.toThrow("هزینه فعال");
    await db.transaction((tx) =>
      includeStandaloneCost(tx, f.buildingId, id, f.periodId),
    );
    const linkedAgain = await db.query.standaloneExpense.findFirst({
      where: eq(s.standaloneExpense.id, id),
    });
    expect(
      await db.query.expenseLine.findFirst({
        where: eq(s.expenseLine.id, linkedAgain!.linkedExpenseId!),
      }),
    ).toMatchObject({ coverageMonths: 3 });
    await db.transaction((tx) => detachStandaloneCost(tx, f.buildingId, id));
    expect((await f.state()).balanceRial).toBe(before.balanceRial);
    expect(
      (await f.state()).costs.filter((c) => c.title === "تجهیزات و لوازم"),
    ).toHaveLength(1);
  });
  it("does not move general charge receipts or another building's cost", async () => {
    const f = await fixture(),
      other = await fixture();
    const expenseId = crypto.randomUUID();
    await db.insert(s.expenseLine).values({
      id: expenseId,
      periodId: f.periodId,
      categoryId: f.categoryId,
      amountRial: 10_000_000,
      expenseDate: new Date("2026-10-25"),
    });
    await expect(
      db.transaction((tx) =>
        makeExpenseStandalone(tx, other.buildingId, expenseId),
      ),
    ).rejects.toThrow("پیدا نشد");
    await db.transaction((tx) =>
      makeExpenseStandalone(tx, f.buildingId, expenseId),
    );
    const payments = (await loadSettlementData(db, f.buildingId)).payments;
    expect(payments).toHaveLength(1);
    expect(payments[0].standaloneExpenseId).toBeNull();
  });
  it("keeps all collected cash until a payment is confirmed, including independent costs", async () => {
    const f = await fixture();
    expect(await f.state()).toMatchObject({
      balanceRial: 50_000_000,
      paidRial: 0,
      pendingRial: 39_000_000,
    });
    const data = await getFinanceData(f.buildingId);
    expect(dashboardData(data).treasury.balanceRial).toBe(50_000_000);
    expect(data.treasury.costs[0].state).toBe("پرداخت‌نشده");
    expect(
      dashboardData(data).cashTimeline.reduce(
        (sum, month) => sum + month.expense,
        0,
      ),
    ).toBe(0);
  });
  it("settles below estimate using the actual amount, preserves receipts and can reverse a mistake", async () => {
    const f = await fixture(),
      value = f.input();
    await f.pay(value);
    expect(
      dashboardData(await getFinanceData(f.buildingId)).cashTimeline.reduce(
        (sum, month) => sum + month.expense,
        0,
      ),
    ).toBe(35_000_000);
    expect(await f.state()).toMatchObject({
      balanceRial: 15_000_000,
      pendingRial: 0,
      costs: [
        { estimateRial: 39_000_000, actualRial: 35_000_000, settled: true },
      ],
    });
    await db.transaction((tx) =>
      cancelDisbursement(tx, f.buildingId, value.id, "پرداخت نشده بود"),
    );
    expect(await f.state()).toMatchObject({
      balanceRial: 50_000_000,
      paidRial: 0,
      pendingRial: 39_000_000,
    });
    const data = await getFinanceData(f.buildingId);
    expect(data.payments).toHaveLength(1);
    expect(
      dashboardData(data).cashTimeline.reduce(
        (sum, month) => sum + month.expense,
        0,
      ),
    ).toBe(0);
    expect(data.disbursements[0].cancellationReason).toBe("پرداخت نشده بود");
    expect(
      await db
        .select()
        .from(s.managementEvent)
        .where(eq(s.managementEvent.entityId, value.id)),
    ).toHaveLength(2);
    await expect(
      db.transaction((tx) =>
        cancelDisbursement(tx, f.buildingId, value.id, "تکرار"),
      ),
    ).rejects.toThrow("قبلاً");
  });
  it("records partial payments and settles above estimate, even with a negative recorded balance", async () => {
    const f = await fixture();
    await f.pay(f.input({ amountRial: 10_000_000, finalPayment: false }));
    expect(await f.state()).toMatchObject({
      balanceRial: 40_000_000,
      pendingRial: 29_000_000,
      costs: [{ state: "بخشی پرداخت‌شده", actualRial: null }],
    });
    await f.pay(f.input({ amountRial: 45_000_000 }));
    expect(await f.state()).toMatchObject({
      balanceRial: -5_000_000,
      pendingRial: 0,
      costs: [{ actualRial: 55_000_000 }],
    });
    await expect(f.pay(f.input())).rejects.toThrow("تسویه");
  });
  it("uses one receipt id for retries, and rejects reusing that id for another amount", async () => {
    const f = await fixture(),
      value = f.input({ finalPayment: false });
    await f.pay(value);
    await f.pay(value);
    expect((await f.state()).paidRial).toBe(35_000_000);
    await expect(f.pay({ ...value, amountRial: 1 })).rejects.toThrow("شناسه");
  });
  it("requires the purchase item sum to match the cash debit and preserves the item details", async () => {
    const f = await fixture();
    const items = [
      { description: "تاید", amountRial: 2_000_000 },
      { description: "مایع", amountRial: 3_000_000 },
    ];
    await expect(f.pay(f.input({ items }))).rejects.toThrow("جمع");
    expect((await f.state()).paidRial).toBe(0);
    const value = f.input({ items, amountRial: 5_000_000, reference: "12345" });
    await f.pay(value);
    await f.pay(value);
    expect((await f.state()).paidRial).toBe(5_000_000);
    await expect(f.pay({ ...value, finalPayment: false })).rejects.toThrow(
      "شناسه",
    );
    expect((await getFinanceData(f.buildingId)).disbursements[0]).toMatchObject(
      { items, reference: "12345" },
    );
  });
  it("reopens only the remaining cost when a final payment is cancelled after an earlier installment", async () => {
    const f = await fixture();
    const partial = f.input({ amountRial: 10_000_000, finalPayment: false });
    const final = f.input({ amountRial: 20_000_000 });
    await f.pay(partial);
    await f.pay(final);
    await db.transaction((tx) =>
      cancelDisbursement(tx, f.buildingId, final.id, "مبلغ اشتباه"),
    );
    expect(await f.state()).toMatchObject({
      balanceRial: 40_000_000,
      pendingRial: 29_000_000,
      costs: [
        { paidRial: 10_000_000, settled: false, state: "بخشی پرداخت‌شده" },
      ],
    });
  });
  it("does not debit cash for a unit's direct advance or count it twice after billing and detaching", async () => {
    const f = await fixture();
    await db.transaction((tx) =>
      insertUnitPayment(
        tx,
        {
          unitId: f.unitId,
          standaloneExpenseId: f.standaloneExpenseId,
          kind: "advance",
          amountRial: 5_000_000,
          paidAt: new Date("2026-10-26"),
          method: "cash",
        },
        f.buildingId,
      ),
    );
    await f.pay(f.input({ amountRial: 34_000_000 }));
    expect(await f.state()).toMatchObject({
      balanceRial: 16_000_000,
      costs: [{ directRial: 5_000_000, actualRial: 39_000_000 }],
    });
    await db.transaction((tx) =>
      includeStandaloneCost(
        tx,
        f.buildingId,
        f.standaloneExpenseId,
        f.periodId,
      ),
    );
    expect((await f.state()).costs).toHaveLength(1);
    await db.transaction((tx) =>
      detachStandaloneCost(tx, f.buildingId, f.standaloneExpenseId),
    );
    expect(await f.state()).toMatchObject({
      balanceRial: 16_000_000,
      costs: [{ actualRial: 39_000_000 }],
    });
  });
  it("preserves cash payments when a linked independent cost leaves a removed period", async () => {
    const f = await fixture();
    await f.pay(f.input());
    await db.transaction((tx) =>
      includeStandaloneCost(
        tx,
        f.buildingId,
        f.standaloneExpenseId,
        f.periodId,
      ),
    );
    await db.transaction((tx) => removePeriod(tx, f.buildingId, f.periodId));
    expect(await f.state()).toMatchObject({
      balanceRial: 15_000_000,
      costs: [{ periodId: null, settled: true }],
    });
  });
  it("supports period bills after invoice issue without changing residents' charges", async () => {
    const f = await fixture(),
      expenseId = crypto.randomUUID();
    await db.insert(s.expenseLine).values({
      id: expenseId,
      periodId: f.periodId,
      categoryId: f.categoryId,
      amountRial: 10_000_000,
      expenseDate: new Date("2026-10-25"),
    });
    await finalizeBillingPeriod(f.periodId);
    const before = await getFinanceData(f.buildingId);
    await f.pay(
      f.input({
        expenseId,
        standaloneExpenseId: undefined,
        amountRial: 9_000_000,
      }),
    );
    const after = await getFinanceData(f.buildingId);
    expect(after.invoices).toEqual(before.invoices);
    expect(after.treasury.balanceRial).toBe(41_000_000);
    await expect(
      db.transaction((tx) =>
        correctExpense(tx, f.buildingId, expenseId, "delete"),
      ),
    ).rejects.toThrow("پرداخت از حساب");
    await expect(
      db.transaction((tx) => removePeriod(tx, f.buildingId, f.periodId)),
    ).rejects.toThrow("پرداخت از حساب");
  });
  it("blocks deletion of a cost with active cash payments, then allows it after cancellation", async () => {
    const f = await fixture(),
      value = f.input();
    await f.pay(value);
    await expect(
      db.transaction((tx) =>
        setStandaloneCostDeleted(tx, f.buildingId, f.standaloneExpenseId, true),
      ),
    ).rejects.toThrow("پرداخت از حساب");
    await db.transaction((tx) =>
      cancelDisbursement(tx, f.buildingId, value.id, "اشتباه"),
    );
    const receipt = (await getFinanceData(f.buildingId)).payments[0].payment;
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt.id, "delete"),
    );
    await db.transaction((tx) =>
      setStandaloneCostDeleted(tx, f.buildingId, f.standaloneExpenseId, true),
    );
    expect((await f.state()).costs).toHaveLength(0);
    expect((await getFinanceData(f.buildingId)).disbursements).toHaveLength(1);
  });
  it("rejects another building's cost, cancellation, deleted cost, invalid date and invalid amount", async () => {
    const f = await fixture(),
      other = await fixture(),
      value = f.input();
    await expect(other.pay(value)).rejects.toThrow("ساختمان");
    await f.pay(value);
    await expect(
      db.transaction((tx) =>
        cancelDisbursement(tx, other.buildingId, value.id, "اشتباه"),
      ),
    ).rejects.toThrow("پیدا نشد");
    await expect(f.pay(f.input({ amountRial: -1 }))).rejects.toThrow();
    await expect(
      f.pay(f.input({ paidAt: new Date("invalid") })),
    ).rejects.toThrow();
    await expect(
      f.pay(
        f.input({
          expenseId: "foreign",
          standaloneExpenseId: f.standaloneExpenseId,
        }),
      ),
    ).rejects.toThrow();
    await db.transaction((tx) =>
      cancelDisbursement(tx, f.buildingId, value.id, "اشتباه"),
    );
    const receipt = (await getFinanceData(f.buildingId)).payments[0].payment;
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt.id, "delete"),
    );
    await db.transaction((tx) =>
      setStandaloneCostDeleted(tx, f.buildingId, f.standaloneExpenseId, true),
    );
    await expect(f.pay(f.input())).rejects.toThrow("فعال");
  });
});

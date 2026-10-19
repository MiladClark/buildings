import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/lib/db/schema");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "hamkhane-billing-test-"));
  const file = join(dir, "test.db");
  const client = createClient({ url: `file:${file}` });
  return { db: drizzle(client, { schema }), client, file, dir };
});
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { finalizeBillingPeriod } from "./finalize";
import { calculateChargeRecommendation } from "./forecast";
import { validateMaintenanceLink } from "./maintenance-link";
import { getFinanceData, dashboardData } from "@/lib/queries/finance";
import { buildingCalendarEvents } from "@/lib/queries/calendar";
import { computeChargeRecommendation } from "./recommendations";
import { fromJalali } from "@/lib/format/jalali";
import { presetPeriodRange } from "./periods";
import {
  applyAvailableCredit,
  insertUnitPayment,
  loadSettlementData,
  reconcileDraftPayments,
} from "./settlement-store";
import {
  correctReceipt,
  correctExpense,
  reopenPeriod,
  removePeriod,
  materializeLegacyPayments,
  releaseCostApplications,
  periodCalculationChanged,
} from "./corrections";
import { buildSettlementState } from "./settlement-state";
beforeAll(async () => {
  const { client } = (await import("@/lib/db")) as unknown as {
    client: import("@libsql/client").Client;
  };
  const migrations = (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const migration of migrations) {
    const sql = await readFile(`drizzle/${migration}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint"))
      if (statement.trim()) await client.execute(statement);
  }
});
afterAll(async () => {
  const { client, file, dir } = (await import("@/lib/db")) as unknown as {
    client: import("@libsql/client").Client;
    file: string;
    dir: string;
  };
  client.close();
  const { unlink, rmdir } = await import("node:fs/promises");
  await Promise.allSettled(
    [file, `${file}-wal`, `${file}-shm`].map((p) => unlink(p)),
  );
  // Windows may keep a SQLite transaction handle until the worker exits.
  await rmdir(dir).catch((error: NodeJS.ErrnoException) => {
    if (!["ENOTEMPTY", "EBUSY", "EPERM"].includes(error.code ?? ""))
      throw error;
  });
});
async function fixture(empty = false) {
  const buildingId = crypto.randomUUID(),
    unitId = crypto.randomUUID(),
    categoryId = crypto.randomUUID();
  await db.insert(schema.building).values({ id: buildingId, name: "آزمایش" });
  await db.insert(schema.unit).values({
    id: unitId,
    buildingId,
    label: "۱",
    occupantCount: empty ? 0 : 2,
    status: empty ? "empty" : "occupied",
  });
  await db.insert(schema.expenseCategory).values({
    id: categoryId,
    buildingId,
    name: "آب",
    slug: "water",
    allocationMethod: "per_person",
  });
  const period = async (month: number, value: number, endMonth = month) => {
    const id = crypto.randomUUID();
    await db.insert(schema.billingPeriod).values({
      id,
      buildingId,
      title: "دوره آزمایشی",
      periodType: endMonth !== month ? "quarterly" : "monthly",
      startDate: fromJalali(1405, month, 1),
      endDate: fromJalali(1405, endMonth, 30),
    });
    await db.insert(schema.expenseLine).values({
      id: crypto.randomUUID(),
      periodId: id,
      categoryId,
      amountRial: value,
      expenseDate: fromJalali(1405, month, 5),
    });
    return id;
  };
  return { buildingId, unitId, categoryId, period };
}
describe("transactional billing", () => {
  it("persists a two-month period and bills fixed monthly fees exactly twice", async () => {
    const f = await fixture();
    const id = crypto.randomUUID();
    const range = presetPeriodRange("2027-01-21", "bimonthly");
    await db.insert(schema.billingPeriod).values({
      id,
      buildingId: f.buildingId,
      title: "شارژ دوماهه",
      periodType: "bimonthly",
      startDate: new Date(range.startDate),
      endDate: new Date(range.endDate),
    });
    await db
      .update(schema.expenseCategory)
      .set({
        allocationMethod: "fixed_per_unit",
        fixedMonthlyAmount: 4_500_000,
      })
      .where(eq(schema.expenseCategory.id, f.categoryId));
    await finalizeBillingPeriod(id);
    const saved = await db.query.billingPeriod.findFirst({
      where: eq(schema.billingPeriod.id, id),
    });
    const invoice = await db.query.unitInvoice.findFirst({
      where: eq(schema.unitInvoice.periodId, id),
    });
    expect(saved?.periodType).toBe("bimonthly");
    expect(invoice?.totalRial).toBe(9_000_000);
  });
  async function costFixture(oldDebt = true) {
    const f = await fixture();
    await db
      .update(schema.expenseCategory)
      .set({ name: "نظافت", allocationMethod: "per_unit" })
      .where(eq(schema.expenseCategory.id, f.categoryId));
    let oldPeriod: string | undefined;
    if (oldDebt) {
      const electricity = crypto.randomUUID();
      await db.insert(schema.expenseCategory).values({
        id: electricity,
        buildingId: f.buildingId,
        name: "برق",
        slug: electricity,
        allocationMethod: "per_unit",
      });
      oldPeriod = await f.period(1, 1_000_000);
      await db
        .update(schema.expenseLine)
        .set({ categoryId: electricity })
        .where(eq(schema.expenseLine.periodId, oldPeriod));
      await finalizeBillingPeriod(oldPeriod);
    }
    const target = await f.period(2, 4_500_000);
    const pay = async (
      amountRial: number,
      key = crypto.randomUUID(),
      general = false,
    ) =>
      db.transaction((tx) =>
        insertUnitPayment(
          tx,
          {
            unitId: f.unitId,
            ...(general ? {} : { periodId: target, categoryId: f.categoryId }),
            amountRial,
            method: "bank_transfer",
            paidAt: new Date("2026-10-19T00:00:00Z"),
            receiptKey: key,
          },
          f.buildingId,
        ),
      );
    const read = async () => {
      const loaded = await loadSettlementData(db, f.buildingId);
      const state = buildSettlementState(loaded);
      const account = state.accounts[0];
      expect(account.receivedRial).toBe(
        account.creditRial +
          account.reservedRial +
          loaded.invoices.reduce((s, i) => s + i.paidRial, 0),
      );
      for (const p of loaded.payments.filter((p) => p.allocationTracked))
        expect(
          loaded.applications
            .filter((a) => a.paymentId === p.id)
            .reduce((s, a) => s + a.amountRial, 0),
        ).toBeLessThanOrEqual(p.amountRial);
      return {
        loaded,
        ...state,
        account,
        target: state.shares.find((s) => s.periodId === target)!,
      };
    };
    return { ...f, targetPeriod: target, oldPeriod, pay, read };
  }

  it("voids and restores one receipt without moving other payments or old debt", async () => {
    const f = await costFixture();
    const receipt = await f.pay(4_700_000);
    const second = await f.pay(100_000);
    await finalizeBillingPeriod(f.targetPeriod);
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt, "delete"),
    );
    let state = await f.read();
    expect(state.account.receivedRial).toBe(100_000);
    expect(state.target.paidRial).toBe(0);
    expect(state.target.balanceRial).toBe(4_500_000);
    expect(state.account.creditRial).toBe(100_000);
    expect(state.loaded.payments.map((p) => p.id)).toEqual([second]);
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt, "restore"),
    );
    state = await f.read();
    expect(state.target.paidRial).toBe(4_500_000);
    expect(state.account.creditRial).toBe(300_000);
    expect(state.account.debtRial).toBe(1_000_000);
    await expect(
      db.transaction((tx) =>
        correctReceipt(tx, f.buildingId, receipt, "restore"),
      ),
    ).rejects.toThrow("وضعیت");
  });
  it("reverses allocations funded by the same receipt across several future bills", async () => {
    const f = await costFixture(false);
    const receipt = await f.pay(6_000_000);
    await finalizeBillingPeriod(f.targetPeriod);
    const future = await f.period(3, 1_000_000);
    await finalizeBillingPeriod(future);
    expect((await f.read()).account.creditRial).toBe(500_000);
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt, "delete"),
    );
    const state = await f.read();
    expect(state.account).toMatchObject({
      receivedRial: 0,
      creditRial: 0,
      debtRial: 5_500_000,
    });
    expect(state.loaded.invoices.every((i) => i.paidRial === 0)).toBe(true);
  });
  it("edits a receipt in place and releases its former allocations", async () => {
    const f = await costFixture();
    const receipt = await f.pay(4_700_000);
    await finalizeBillingPeriod(f.targetPeriod);
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt, "edit", undefined, {
        unitId: f.unitId,
        periodId: f.targetPeriod,
        categoryId: f.categoryId,
        amountRial: 2_000_000,
        method: "cash",
        paidAt: new Date(),
        note: "اصلاح مبلغ",
      }),
    );
    const state = await f.read();
    expect(state.loaded.payments).toHaveLength(1);
    expect(state.loaded.payments[0]).toMatchObject({
      id: receipt,
      amountRial: 2_000_000,
      method: "cash",
    });
    expect(state.target.balanceRial).toBe(2_500_000);
    expect(state.account).toMatchObject({
      receivedRial: 2_000_000,
      creditRial: 0,
      debtRial: 3_500_000,
    });
  });
  it("moves a mistaken receipt to the right unit and reverses only its original settlement", async () => {
    const f = await costFixture(false);
    const other = crypto.randomUUID();
    await db.insert(schema.unit).values({
      id: other,
      buildingId: f.buildingId,
      label: "۲",
      occupantCount: 1,
    });
    const receipt = await f.pay(2_000_000);
    await finalizeBillingPeriod(f.targetPeriod);
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt, "edit", undefined, {
        unitId: other,
        periodId: f.targetPeriod,
        categoryId: f.categoryId,
        amountRial: 2_000_000,
        method: "cash",
        paidAt: new Date(),
      }),
    );
    const state = buildSettlementState(
      await loadSettlementData(db, f.buildingId),
    );
    expect(state.accounts.find((a) => a.unitId === f.unitId)).toMatchObject({
      receivedRial: 0,
      debtRial: 2_250_000,
    });
    expect(state.accounts.find((a) => a.unitId === other)).toMatchObject({
      receivedRial: 2_000_000,
      debtRial: 250_000,
    });
  });
  it("opens issued bills for correction, preserves cash and snapshots, and issues once again", async () => {
    const f = await costFixture(false);
    await f.pay(4_700_000);
    await finalizeBillingPeriod(f.targetPeriod);
    const original = await f.read();
    await db.transaction((tx) =>
      reopenPeriod(tx, f.buildingId, f.targetPeriod),
    );
    let state = await f.read();
    expect(state.loaded.invoices).toHaveLength(0);
    expect(state.account).toMatchObject({
      receivedRial: 4_700_000,
      creditRial: 200_000,
      reservedRial: 4_500_000,
      debtRial: 0,
    });
    const event = await db.query.managementEvent.findFirst({
      where: eq(schema.managementEvent.entityId, f.targetPeriod),
    });
    const preserved = JSON.parse(event!.beforeJson!);
    expect(preserved.invoices[0].id).toBe(original.loaded.invoices[0].id);
    expect(preserved.lines).toHaveLength(1);
    expect(preserved.snapshots).toHaveLength(1);
    await finalizeBillingPeriod(f.targetPeriod);
    state = await f.read();
    expect(state.loaded.invoices).toHaveLength(1);
    expect(state.loaded.invoices[0].id).not.toBe(
      original.loaded.invoices[0].id,
    );
    expect(state.target.paidRial).toBe(4_500_000);
    expect(state.loaded.payments).toHaveLength(1);
  });
  it("deletes a finalized period without deleting its cash or other periods", async () => {
    const f = await costFixture();
    const receipt = await f.pay(4_700_000);
    await finalizeBillingPeriod(f.targetPeriod);
    await db.transaction((tx) =>
      removePeriod(tx, f.buildingId, f.targetPeriod),
    );
    const loaded = await loadSettlementData(db, f.buildingId);
    const state = buildSettlementState(loaded);
    expect(state.accounts[0]).toMatchObject({
      receivedRial: 4_700_000,
      creditRial: 4_700_000,
      debtRial: 1_000_000,
      reservedRial: 0,
    });
    expect(loaded.periods.map((p) => p.id)).toEqual([f.oldPeriod]);
    expect(loaded.payments[0].id).toBe(receipt);
    // Reviving the period never invents paid amounts or a second cash receipt.
    await db
      .update(schema.billingPeriod)
      .set({ deletedAt: null })
      .where(eq(schema.billingPeriod.id, f.targetPeriod));
    expect((await f.read()).target.paidRial).toBe(0);
    await finalizeBillingPeriod(f.targetPeriod);
    expect((await f.read()).account.creditRial).toBe(200_000);
  });
  it("edits/deletes/restores a finalized cost with recalculation and no lost overpayment", async () => {
    const f = await costFixture(false);
    await f.pay(4_700_000);
    await finalizeBillingPeriod(f.targetPeriod);
    const line = (await f.read()).loaded.expenses[0];
    await db.transaction((tx) =>
      correctExpense(tx, f.buildingId, line.id, "edit", undefined, {
        categoryId: f.categoryId,
        amountRial: 3_000_000,
        description: "اصلاح نظافت",
        expenseDate: new Date(),
      }),
    );
    expect((await f.read()).account).toMatchObject({
      reservedRial: 3_000_000,
      creditRial: 1_700_000,
    });
    await db.transaction((tx) =>
      correctExpense(tx, f.buildingId, line.id, "delete"),
    );
    let loaded = await loadSettlementData(db, f.buildingId);
    expect(loaded.expenses).toHaveLength(0);
    expect(buildSettlementState(loaded).accounts[0].creditRial).toBe(4_700_000);
    await db.transaction((tx) =>
      correctExpense(tx, f.buildingId, line.id, "restore"),
    );
    await finalizeBillingPeriod(f.targetPeriod);
    loaded = await loadSettlementData(db, f.buildingId);
    expect(loaded.invoices[0]).toMatchObject({
      totalRial: 3_000_000,
      paidRial: 3_000_000,
    });
    expect(buildSettlementState(loaded).accounts[0].creditRial).toBe(1_700_000);
  });
  it("materializes aggregate legacy settlements and anonymous credit before voiding an old receipt", async () => {
    const f = await costFixture(false);
    await finalizeBillingPeriod(f.targetPeriod);
    const invoice = (await f.read()).loaded.invoices[0];
    await db
      .update(schema.unitInvoice)
      .set({
        paidRial: 3_000_000,
        legacyPaidRial: 3_000_000,
        balanceRial: 1_500_000,
      })
      .where(eq(schema.unitInvoice.id, invoice.id));
    const first = crypto.randomUUID(),
      second = crypto.randomUUID();
    for (const [id, amountRial] of [
      [first, 2_000_000],
      [second, 3_000_000],
    ] as const)
      await db.insert(schema.payment).values({
        id,
        buildingId: f.buildingId,
        unitId: f.unitId,
        amountRial,
        method: "cash",
        paidAt: new Date(),
      });
    const draft = await f.period(3, 1_000_000);
    await db.transaction(async (tx) => {
      const state = buildSettlementState(
        await loadSettlementData(tx, f.buildingId),
      );
      await applyAvailableCredit(
        tx,
        f.buildingId,
        f.unitId,
        state.shares.filter((s) => s.periodId === draft),
      );
    });
    const before = await f.read();
    expect(before.account).toMatchObject({
      creditRial: 1_000_000,
      reservedRial: 1_000_000,
    });
    await db.transaction((tx) => materializeLegacyPayments(tx, f.buildingId));
    const after = await f.read();
    expect(after.account).toEqual(before.account);
    expect(after.target.paidRial).toBe(before.target.paidRial);
    expect(after.loaded.applications.every((a) => a.paymentId !== null)).toBe(
      true,
    );
    expect(after.loaded.invoices[0].legacyPaidRial).toBe(0);
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, first, "delete"),
    );
    const corrected = await f.read();
    expect(corrected.account.receivedRial).toBe(3_000_000);
    expect(corrected.account.receivedRial).toBe(
      corrected.account.creditRial +
        corrected.account.reservedRial +
        corrected.loaded.invoices[0].paidRial,
    );
  });
  it("rolls back invalid corrections and rejects records from another building", async () => {
    const f = await costFixture(false),
      other = await costFixture(false);
    const receipt = await f.pay(4_700_000);
    await finalizeBillingPeriod(f.targetPeriod);
    const before = await f.read();
    await expect(
      db.transaction((tx) =>
        correctReceipt(tx, other.buildingId, receipt, "delete"),
      ),
    ).rejects.toThrow("پیدا نشد");
    await expect(
      db.transaction((tx) =>
        removePeriod(tx, other.buildingId, f.targetPeriod),
      ),
    ).rejects.toThrow("پیدا نشد");
    await expect(
      db.transaction((tx) =>
        correctReceipt(tx, f.buildingId, receipt, "edit", undefined, {
          unitId: other.unitId,
          amountRial: -10,
          method: "cash",
          paidAt: new Date(),
        }),
      ),
    ).rejects.toThrow();
    expect((await f.read()).account).toEqual(before.account);
    expect((await f.read()).target.paidRial).toBe(before.target.paidRial);
    const line = before.loaded.expenses[0];
    await expect(
      db.transaction((tx) =>
        correctExpense(tx, other.buildingId, line.id, "delete"),
      ),
    ).rejects.toThrow();
    expect((await f.read()).loaded.expenses).toHaveLength(1);
  });

  it("excludes removed units from new charges while retaining their frozen debt and cash", async () => {
    const f = await costFixture(false);
    const other = crypto.randomUUID();
    await db.insert(schema.unit).values({
      id: other,
      buildingId: f.buildingId,
      label: "۲",
      occupantCount: 1,
    });
    await f.pay(2_300_000);
    await finalizeBillingPeriod(f.targetPeriod);
    const old = (await loadSettlementData(db, f.buildingId)).invoices.find(
      (i) => i.unitId === f.unitId,
    )!;
    await db.transaction(async (tx) => {
      await tx
        .update(schema.unit)
        .set({ deletedAt: new Date() })
        .where(eq(schema.unit.id, f.unitId));
      await reconcileDraftPayments(tx, f.buildingId);
    });
    const next = await f.period(3, 4_500_000);
    const before = buildSettlementState(
      await loadSettlementData(db, f.buildingId),
    );
    expect(before.shares.filter((s) => s.periodId === next)).toHaveLength(1);
    expect(before.accounts.find((a) => a.unitId === f.unitId)).toMatchObject({
      receivedRial: 2_300_000,
      creditRial: 50_000,
    });
    await finalizeBillingPeriod(next);
    const loaded = await loadSettlementData(db, f.buildingId);
    expect(loaded.invoices.find((i) => i.id === old.id)).toEqual(old);
    expect(loaded.invoices.filter((i) => i.periodId === next)).toHaveLength(1);
    expect(loaded.invoices.find((i) => i.periodId === next)?.totalRial).toBe(
      4_500_000,
    );
  });
  it("stops a removed fixed rule while preserving posted variable costs on inactive categories", async () => {
    const f = await costFixture(false);
    const fixed = crypto.randomUUID();
    await db.insert(schema.expenseCategory).values({
      id: fixed,
      buildingId: f.buildingId,
      name: "ذخیره ثابت",
      slug: fixed,
      allocationMethod: "fixed_per_unit",
      fixedMonthlyAmount: 1_000_000,
      active: false,
    });
    await db
      .update(schema.expenseCategory)
      .set({ active: false })
      .where(eq(schema.expenseCategory.id, f.categoryId));
    const before = await f.read();
    expect(before.target.amountRial).toBe(4_500_000);
    await db.transaction((tx) =>
      correctExpense(
        tx,
        f.buildingId,
        before.loaded.expenses[0].id,
        "edit",
        undefined,
        {
          categoryId: f.categoryId,
          amountRial: 4_500_000,
          description: "اصلاح شرح دسته غیرفعال",
          expenseDate: new Date(),
        },
      ),
    );
    await finalizeBillingPeriod(f.targetPeriod);
    const after = await f.read();
    expect(after.loaded.invoices[0].totalRial).toBe(4_500_000);
    expect(after.target.amountRial).toBe(before.target.amountRial);
  });
  it("prevents recovery of a report's old cash receipt after the same report was approved again", async () => {
    const f = await costFixture(false);
    const requestId = crypto.randomUUID();
    const first = await f.pay(2_000_000, `request:${requestId}`);
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, first, "delete"),
    );
    await f.pay(2_000_000, `request:${requestId}:second`);
    await expect(
      db.transaction((tx) =>
        correctReceipt(tx, f.buildingId, first, "restore"),
      ),
    ).rejects.toThrow("دوبار");
    expect((await f.read()).account.receivedRial).toBe(2_000_000);
  });

  it("preserves downstream credit allocations when editing only receipt metadata", async () => {
    const f = await costFixture(false);
    const receipt = await f.pay(6_000_000);
    await finalizeBillingPeriod(f.targetPeriod);
    const future = await f.period(3, 1_000_000);
    await finalizeBillingPeriod(future);
    const before = await f.read();
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt, "edit", undefined, {
        unitId: f.unitId,
        periodId: f.targetPeriod,
        categoryId: f.categoryId,
        amountRial: 6_000_000,
        method: "other",
        paidAt: new Date("2026-10-20"),
        note: "فقط اصلاح پیگیری",
      }),
    );
    const after = await f.read();
    expect(after.account).toEqual(before.account);
    expect(after.loaded.applications).toEqual(before.loaded.applications);
    expect(after.loaded.invoices).toEqual(before.loaded.invoices);
    expect(after.loaded.payments[0].note).toBe("فقط اصلاح پیگیری");
  });

  it("compares billing ranges by Tehran calendar day rather than time of day", () => {
    const original = {
      startDate: fromJalali(1405, 8, 1),
      endDate: fromJalali(1405, 8, 30),
      periodType: "monthly",
    };
    expect(
      periodCalculationChanged(original, {
        ...original,
        startDate: new Date("2026-10-23T00:00:00Z"),
        endDate: new Date("2026-11-21T00:00:00Z"),
      }),
    ).toBe(false);
    expect(
      periodCalculationChanged(original, {
        ...original,
        periodType: "quarterly",
      }),
    ).toBe(true);
    expect(
      periodCalculationChanged(original, {
        ...original,
        endDate: fromJalali(1405, 9, 1),
      }),
    ).toBe(true);
  });

  it("keeps accounts, dashboard, calendar and live recommendations in sync after financial corrections", async () => {
    const f = await costFixture(false);
    const receipt = await f.pay(4_700_000);
    await finalizeBillingPeriod(f.targetPeriod);
    await db
      .update(schema.billingPeriod)
      .set({ dueDate: new Date("2026-12-01") })
      .where(eq(schema.billingPeriod.id, f.targetPeriod));
    let finance = await getFinanceData(f.buildingId);
    let dashboard = dashboardData(finance);
    expect(dashboard.summaries[0]).toMatchObject({
      paid: 4_700_000,
      balance: -200_000,
      credit: 200_000,
    });
    expect(dashboard.calendarEvents).toEqual(buildingCalendarEvents(finance));
    expect(
      dashboard.calendarEvents.find((e) => e.kind === "due")?.needsPayment,
    ).toBe(false);
    expect(
      calculateChargeRecommendation(
        await loadSettlementData(db, f.buildingId),
        3,
      ).suggestedMonthlyRial,
    ).toBe(4_500_000);
    await db
      .update(schema.billingPeriod)
      .set({ status: "archived" })
      .where(eq(schema.billingPeriod.id, f.targetPeriod));
    expect(
      calculateChargeRecommendation(
        await loadSettlementData(db, f.buildingId),
        3,
      ).suggestedMonthlyRial,
    ).toBe(4_500_000);
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt, "delete"),
    );
    finance = await getFinanceData(f.buildingId);
    dashboard = dashboardData(finance);
    expect(dashboard.summaries[0]).toMatchObject({
      paid: 0,
      balance: 4_500_000,
      debt: 4_500_000,
    });
    expect(dashboard.timeline.reduce((s, m) => s + m.income, 0)).toBe(0);
    expect(dashboard.calendarEvents.some((e) => e.kind === "payment")).toBe(
      false,
    );
    expect(
      dashboard.calendarEvents.find((e) => e.kind === "due")?.needsPayment,
    ).toBe(true);
    await db.transaction((tx) =>
      removePeriod(tx, f.buildingId, f.targetPeriod),
    );
    finance = await getFinanceData(f.buildingId);
    expect(finance.expenses).toHaveLength(0);
    expect(dashboardData(finance).calendarEvents).toHaveLength(0);
    const removedLedger = await loadSettlementData(db, f.buildingId);
    expect(() => calculateChargeRecommendation(removedLedger, 3)).toThrow();
  });
  it("recomputes current fixed budgets from active units and current rules", async () => {
    const f = await fixture();
    const id = await f.period(1, 300, 3);
    await finalizeBillingPeriod(id);
    const fixed = crypto.randomUUID();
    await db.insert(schema.expenseCategory).values({
      id: fixed,
      buildingId: f.buildingId,
      name: "شارژ ثابت",
      slug: fixed,
      allocationMethod: "fixed_per_unit",
      fixedMonthlyAmount: 50,
    });
    let result = calculateChargeRecommendation(
      await loadSettlementData(db, f.buildingId),
      3,
    );
    expect(result.suggestedMonthlyRial).toBe(150);
    await db
      .update(schema.expenseCategory)
      .set({ fixedMonthlyAmount: 80 })
      .where(eq(schema.expenseCategory.id, fixed));
    result = calculateChargeRecommendation(
      await loadSettlementData(db, f.buildingId),
      3,
    );
    expect(result.suggestedMonthlyRial).toBe(180);
    await db
      .update(schema.expenseCategory)
      .set({ active: false })
      .where(eq(schema.expenseCategory.id, fixed));
    expect(
      calculateChargeRecommendation(
        await loadSettlementData(db, f.buildingId),
        3,
      ).suggestedMonthlyRial,
    ).toBe(100);
  });
  it("connects maintenance, expenses and calendar without conflating work status and payment", async () => {
    const f = await costFixture(false),
      other = await costFixture(false);
    const actor = crypto.randomUUID(),
      ticket = crypto.randomUUID();
    await db.insert(schema.user).values({
      id: actor,
      name: "مدیر آزمایشی",
      email: `${actor}@test.local`,
    });
    await db.insert(schema.maintenanceTicket).values({
      id: ticket,
      buildingId: f.buildingId,
      createdBy: actor,
      title: "تعمیر چراغ",
      scheduledAt: new Date("2026-10-20"),
    });
    const original = (await f.read()).loaded.expenses[0];
    await db.transaction((tx) =>
      correctExpense(tx, f.buildingId, original.id, "edit", undefined, {
        categoryId: f.categoryId,
        amountRial: original.amountRial,
        expenseDate: original.expenseDate,
        description: "چراغ",
        maintenanceTicketId: ticket,
      }),
    );
    await finalizeBillingPeriod(f.targetPeriod);
    const invoice = (await f.read()).loaded.invoices[0];
    await db.transaction((tx) =>
      correctExpense(tx, f.buildingId, original.id, "edit", undefined, {
        categoryId: f.categoryId,
        amountRial: original.amountRial,
        expenseDate: original.expenseDate,
        description: "شرح اصلاح‌شده",
        maintenanceTicketId: ticket,
      }),
    );
    expect((await f.read()).loaded.invoices[0]).toEqual(invoice);
    let finance = await getFinanceData(f.buildingId);
    expect(finance.expenses[0].expense.maintenanceTicketId).toBe(ticket);
    expect(
      buildingCalendarEvents(finance).some(
        (e) => e.href === `/manager/maintenance?ticket=${ticket}`,
      ),
    ).toBe(true);
    await db
      .update(schema.maintenanceTicket)
      .set({ status: "resolved" })
      .where(eq(schema.maintenanceTicket.id, ticket));
    finance = await getFinanceData(f.buildingId);
    expect(
      buildingCalendarEvents(finance).some((e) => e.kind === "maintenance"),
    ).toBe(false);
    expect(finance.expenses[0].expense.amountRial).toBe(original.amountRial);
    expect(finance.invoices[0].invoice.paidRial).toBe(0);
    await expect(
      db.transaction((tx) =>
        validateMaintenanceLink(tx, other.buildingId, ticket),
      ),
    ).rejects.toThrow();
    await db
      .update(schema.maintenanceTicket)
      .set({ deletedAt: new Date() })
      .where(eq(schema.maintenanceTicket.id, ticket));
    await expect(
      db.transaction((tx) => validateMaintenanceLink(tx, f.buildingId, ticket)),
    ).rejects.toThrow();
    await db.transaction((tx) =>
      validateMaintenanceLink(tx, f.buildingId, ticket, ticket),
    );
    expect((await getFinanceData(f.buildingId)).expenses).toHaveLength(1);
  });
  it("rejects the original resident report when its receipt is reassigned to a different unit", async () => {
    const f = await costFixture(false),
      second = crypto.randomUUID(),
      actor = crypto.randomUUID(),
      request = crypto.randomUUID();
    await db
      .insert(schema.user)
      .values({ id: actor, name: "ساکن", email: `${actor}@test.local` });
    await db.insert(schema.unit).values({
      id: second,
      buildingId: f.buildingId,
      label: "۲",
      occupantCount: 1,
    });
    await db.insert(schema.paymentRequest).values({
      id: request,
      unitId: f.unitId,
      userId: actor,
      amountRial: 100,
      status: "approved",
    });
    const receipt = await f.pay(100, `request:${request}`);
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt, "edit", undefined, {
        unitId: second,
        amountRial: 100,
        method: "cash",
        paidAt: new Date(),
      }),
    );
    expect(
      (
        await db.query.paymentRequest.findFirst({
          where: eq(schema.paymentRequest.id, request),
        })
      )?.status,
    ).toBe("rejected");
    expect(
      (
        await db.query.payment.findFirst({
          where: eq(schema.payment.id, receipt),
        })
      )?.receiptKey,
    ).toMatch(/^corrected:/);
  });

  it("commits resident notices with the ledger, ignores disconnected accounts and rolls notices back on failure", async () => {
    const f = await costFixture(false);
    const connected = crypto.randomUUID(),
      disconnected = crypto.randomUUID();
    for (const id of [connected, disconnected])
      await db
        .insert(schema.user)
        .values({ id, name: "ساکن آزمایشی", email: `${id}@test.local` });
    await db.insert(schema.membership).values([
      {
        id: crypto.randomUUID(),
        buildingId: f.buildingId,
        unitId: f.unitId,
        userId: connected,
        role: "resident",
      },
      {
        id: crypto.randomUUID(),
        buildingId: f.buildingId,
        userId: disconnected,
        role: "resident",
      },
    ]);
    const receipt = await f.pay(4_700_000);
    await finalizeBillingPeriod(f.targetPeriod);
    const notices = () =>
      db
        .select()
        .from(schema.appNotification)
        .where(eq(schema.appNotification.userId, connected));
    expect(await notices()).toHaveLength(2);
    expect(
      await db
        .select()
        .from(schema.appNotification)
        .where(eq(schema.appNotification.userId, disconnected)),
    ).toHaveLength(0);
    await expect(
      db.transaction(async (tx) => {
        await reopenPeriod(tx, f.buildingId, f.targetPeriod);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await notices()).toHaveLength(2);
    expect((await f.read()).loaded.invoices).toHaveLength(1);
    await db.transaction((tx) =>
      correctReceipt(tx, f.buildingId, receipt, "delete"),
    );
    expect(await notices()).toHaveLength(3);
    await db.transaction((tx) =>
      reopenPeriod(tx, f.buildingId, f.targetPeriod),
    );
    expect(await notices()).toHaveLength(4);
  });

  it("reserves 450k toman cleaning, keeps 20k free and never consumes another cost's debt", async () => {
    const f = await costFixture();
    await f.pay(4_700_000);
    const before = await f.read();
    expect(before.target.paidRial).toBe(4_500_000);
    expect(before.target.balanceRial).toBe(0);
    expect(before.account).toMatchObject({
      debtRial: 1_000_000,
      creditRial: 200_000,
      reservedRial: 4_500_000,
      balanceRial: 800_000,
    });
    await finalizeBillingPeriod(f.targetPeriod);
    const after = await f.read();
    expect(after.account).toMatchObject({
      debtRial: 1_000_000,
      creditRial: 200_000,
      reservedRial: 0,
    });
    expect(
      after.loaded.invoices.find((i) => i.periodId === f.oldPeriod)?.paidRial,
    ).toBe(0);
    expect(
      after.loaded.invoices.find((i) => i.periodId === f.targetPeriod)
        ?.paidRial,
    ).toBe(4_500_000);
  });
  it("supports partial payments and additional receipts after finalization", async () => {
    const f = await costFixture(false);
    await f.pay(2_000_000);
    expect((await f.read()).target.balanceRial).toBe(2_500_000);
    await finalizeBillingPeriod(f.targetPeriod);
    await f.pay(2_700_000);
    const state = await f.read();
    expect(state.target.balanceRial).toBe(0);
    expect(state.account.creditRial).toBe(200_000);
    expect(state.loaded.invoices[0].paidRial).toBe(4_500_000);
  });
  it("releases a person-based prepayment when the unit becomes absent and never charges water during absence", async () => {
    const f = await costFixture(false);
    await db
      .update(schema.expenseCategory)
      .set({ allocationMethod: "per_person", name: "آب" })
      .where(eq(schema.expenseCategory.id, f.categoryId));
    await f.pay(4_700_000);
    await db.transaction(async (tx) => {
      await tx
        .update(schema.unit)
        .set({ temporarilyAbsent: true })
        .where(eq(schema.unit.id, f.unitId));
      await reconcileDraftPayments(tx, f.buildingId);
    });
    const state = await f.read();
    expect(state.target.amountRial).toBe(0);
    expect(state.account).toMatchObject({
      reservedRial: 0,
      creditRial: 4_700_000,
    });
    await expect(finalizeBillingPeriod(f.targetPeriod)).rejects.toThrow(
      "بدون سهم",
    );
    await db
      .update(schema.unit)
      .set({ temporarilyAbsent: false })
      .where(eq(schema.unit.id, f.unitId));
    await finalizeBillingPeriod(f.targetPeriod);
    expect((await f.read()).account).toMatchObject({
      reservedRial: 0,
      creditRial: 200_000,
      debtRial: 0,
    });
  });
  it("uses general receipts for issued bills while leaving draft costs unreserved", async () => {
    const f = await costFixture();
    await f.pay(1_500_000, crypto.randomUUID(), true);
    const state = await f.read();
    expect(state.account).toMatchObject({
      debtRial: 0,
      reservedRial: 0,
      creditRial: 500_000,
    });
    expect(state.target.paidRial).toBe(0);
  });
  it("makes repeated submissions idempotent and rejects reusing a receipt for other amounts", async () => {
    const f = await costFixture(false);
    const key = crypto.randomUUID();
    await f.pay(4_700_000, key);
    await f.pay(4_700_000, key);
    expect((await f.read()).loaded.payments).toHaveLength(1);
    await expect(f.pay(4_800_000, key)).rejects.toThrow("شناسه");
    expect((await f.read()).account.creditRial).toBe(200_000);
  });
  it("moves released draft payments back to credit when cost is reduced or removed", async () => {
    const f = await costFixture(false);
    await f.pay(4_700_000);
    await db.transaction(async (tx) => {
      await tx
        .update(schema.expenseLine)
        .set({ amountRial: 4_000_000 })
        .where(eq(schema.expenseLine.periodId, f.targetPeriod));
      await reconcileDraftPayments(tx, f.buildingId);
    });
    expect((await f.read()).account).toMatchObject({
      reservedRial: 4_000_000,
      creditRial: 700_000,
    });
    await db.transaction(async (tx) => {
      await tx
        .delete(schema.expenseLine)
        .where(eq(schema.expenseLine.periodId, f.targetPeriod));
      await reconcileDraftPayments(tx, f.buildingId);
    });
    expect((await f.read()).account).toMatchObject({
      reservedRial: 0,
      creditRial: 4_700_000,
    });
  });
  it("uses credit once for a chosen old debt without recording fictitious cash", async () => {
    const f = await costFixture();
    await f.pay(4_700_000);
    for (let i = 0; i < 2; i++)
      await db.transaction(async (tx) => {
        const state = buildSettlementState(
          await loadSettlementData(tx, f.buildingId),
        );
        await applyAvailableCredit(
          tx,
          f.buildingId,
          f.unitId,
          state.shares.filter((s) => s.periodId === f.oldPeriod),
        );
      });
    const state = await f.read();
    expect(state.account).toMatchObject({
      creditRial: 0,
      debtRial: 800_000,
      reservedRial: 4_500_000,
    });
    expect(state.loaded.payments).toHaveLength(1);
  });
  it("releases and reallocates an exact partial amount while preserving real receipts", async () => {
    const f = await costFixture();
    await f.pay(4_700_000);
    const scope = {
      unitId: f.unitId,
      periodId: f.targetPeriod,
      categoryId: f.categoryId,
    };
    await db.transaction((tx) =>
      releaseCostApplications(tx, f.buildingId, {
        ...scope,
        amountRial: 500_000,
      }),
    );
    let state = await f.read();
    expect(state.target).toMatchObject({
      paidRial: 4_000_000,
      balanceRial: 500_000,
    });
    expect(state.account).toMatchObject({
      receivedRial: 4_700_000,
      creditRial: 700_000,
      reservedRial: 4_000_000,
      debtRial: 1_000_000,
    });
    await db.transaction((tx) =>
      applyAvailableCredit(tx, f.buildingId, f.unitId, [state.target], 200_000),
    );
    state = await f.read();
    expect(state.target).toMatchObject({
      paidRial: 4_200_000,
      balanceRial: 300_000,
    });
    expect(state.account.creditRial).toBe(500_000);
    expect(state.loaded.payments).toHaveLength(1);
    await finalizeBillingPeriod(f.targetPeriod);
    // Issuance consumes remaining free credit according to existing billing rules.
    state = await f.read();
    await db.transaction((tx) =>
      releaseCostApplications(tx, f.buildingId, {
        ...scope,
        amountRial: 100_000,
      }),
    );
    state = await f.read();
    expect(
      state.loaded.invoices.find((i) => i.periodId === f.targetPeriod)
        ?.paidRial,
    ).toBe(4_400_000);
    expect(state.loaded.payments[0].amountRial).toBe(4_700_000);
  });
  it("rejects invalid release amounts and foreign scopes atomically", async () => {
    const f = await costFixture(false);
    await f.pay(4_700_000);
    for (const amountRial of [0, -10, 1.5, 4_500_001, NaN, Infinity])
      await expect(
        db.transaction((tx) =>
          releaseCostApplications(tx, f.buildingId, {
            unitId: f.unitId,
            periodId: f.targetPeriod,
            categoryId: f.categoryId,
            amountRial,
          }),
        ),
      ).rejects.toThrow("مبلغ");
    const foreign = await costFixture(false);
    await expect(
      db.transaction((tx) =>
        releaseCostApplications(tx, foreign.buildingId, {
          unitId: f.unitId,
          periodId: f.targetPeriod,
          categoryId: f.categoryId,
          amountRial: 10,
        }),
      ),
    ).rejects.toThrow("هزینه");
    const state = await f.read();
    expect(state.account).toMatchObject({
      creditRial: 200_000,
      reservedRial: 4_500_000,
    });
    await expect(
      db.transaction((tx) =>
        applyAvailableCredit(tx, f.buildingId, f.unitId, [state.target], -10),
      ),
    ).rejects.toThrow("مبلغ");
  });
  it("releases across multiple receipt allocations without losing their provenance", async () => {
    const f = await costFixture(false);
    const first = await f.pay(2_000_000);
    const second = await f.pay(2_500_000);
    await db.transaction((tx) =>
      releaseCostApplications(tx, f.buildingId, {
        unitId: f.unitId,
        periodId: f.targetPeriod,
        categoryId: f.categoryId,
        amountRial: 3_000_000,
      }),
    );
    const state = await f.read();
    expect(state.target.paidRial).toBe(1_500_000);
    expect(state.account).toMatchObject({
      creditRial: 3_000_000,
      receivedRial: 4_500_000,
    });
    expect(state.loaded.payments.map((p) => p.id)).toEqual(
      expect.arrayContaining([first, second]),
    );
    expect(state.loaded.applications).toHaveLength(1);
    expect([first, second]).toContain(state.loaded.applications[0].paymentId);
  });
  it("carries unspent credit into the next invoice without stealing a draft reservation", async () => {
    const f = await costFixture(false);
    await f.pay(4_700_000);
    const future = await f.period(3, 500_000);
    await finalizeBillingPeriod(future);
    const state = await f.read();
    expect(state.account).toMatchObject({
      creditRial: 0,
      reservedRial: 4_500_000,
      debtRial: 300_000,
    });
    expect(state.loaded.invoices[0].paidRial).toBe(200_000);
    await finalizeBillingPeriod(f.targetPeriod);
    expect((await f.read()).account.debtRial).toBe(300_000);
  });
  it("preserves legacy invoice settlements and spends only legacy credit remaining", async () => {
    const f = await costFixture();
    const old = await db.query.unitInvoice.findFirst({
      where: eq(schema.unitInvoice.periodId, f.oldPeriod!),
    });
    await db.insert(schema.payment).values({
      id: crypto.randomUUID(),
      unitId: f.unitId,
      buildingId: f.buildingId,
      amountRial: 1_200_000,
      method: "cash",
      paidAt: new Date(),
    });
    await db
      .update(schema.unitInvoice)
      .set({ legacyPaidRial: 1_000_000, paidRial: 1_000_000, balanceRial: 0 })
      .where(eq(schema.unitInvoice.id, old!.id));
    await finalizeBillingPeriod(f.targetPeriod);
    const state = await f.read();
    expect(
      state.loaded.invoices.find((i) => i.periodId === f.oldPeriod)?.paidRial,
    ).toBe(1_000_000);
    expect(
      state.loaded.invoices.find((i) => i.periodId === f.targetPeriod)
        ?.paidRial,
    ).toBe(200_000);
    expect(state.account.creditRial).toBe(0);
  });
  it("keeps reservations unit-specific and rejects references from another building", async () => {
    const f = await costFixture(false);
    const other = await costFixture(false);
    await expect(
      db.transaction((tx) =>
        insertUnitPayment(
          tx,
          {
            unitId: f.unitId,
            periodId: other.targetPeriod,
            categoryId: other.categoryId,
            amountRial: 100,
            method: "cash",
            paidAt: new Date(),
          },
          f.buildingId,
        ),
      ),
    ).rejects.toThrow("دوره");
    await expect(
      db.transaction((tx) =>
        insertUnitPayment(
          tx,
          {
            unitId: other.unitId,
            amountRial: 100,
            method: "cash",
            paidAt: new Date(),
          },
          f.buildingId,
        ),
      ),
    ).rejects.toThrow("واحد");
    expect((await f.read()).loaded.payments).toHaveLength(0);
  });
  it("freezes absence and zero water in an invoice, then restores water after return", async () => {
    const f = await fixture();
    await db
      .update(schema.unit)
      .set({
        status: "owner_occupied",
        occupantCount: 4,
        temporarilyAbsent: true,
      })
      .where(eq(schema.unit.id, f.unitId));
    await db.insert(schema.unit).values({
      id: crypto.randomUUID(),
      buildingId: f.buildingId,
      label: "۲",
      occupantCount: 2,
    });
    const commonId = crypto.randomUUID();
    await db.insert(schema.expenseCategory).values({
      id: commonId,
      buildingId: f.buildingId,
      name: "برق مشترک",
      slug: "electricity",
      allocationMethod: "per_unit",
      includeEmptyUnits: false,
    });
    const first = await f.period(1, 600);
    await db.insert(schema.expenseLine).values({
      id: crypto.randomUUID(),
      periodId: first,
      categoryId: commonId,
      amountRial: 200,
      expenseDate: fromJalali(1405, 1, 5),
    });
    const a = await finalizeBillingPeriod(first);
    expect(a.byUnit[f.unitId].totalRial).toBe(100);
    const snapshot = await db.query.periodSnapshot.findFirst({
      where: eq(schema.periodSnapshot.unitId, f.unitId),
    });
    expect(snapshot?.temporarilyAbsent).toBe(true);
    expect(snapshot?.occupantCount).toBe(4);
    const originalInvoice = await db.query.unitInvoice.findFirst({
      where: eq(schema.unitInvoice.unitId, f.unitId),
    });
    const zeroWater = await db.query.invoiceLineItem.findFirst({
      where: (l, { and, eq }) =>
        and(
          eq(l.invoiceId, originalInvoice!.id),
          eq(l.categoryId, f.categoryId),
        ),
    });
    expect(zeroWater?.amountRial).toBe(0);
    expect(zeroWater?.basis).toContain("غیبت موقت");
    await db
      .update(schema.unit)
      .set({ temporarilyAbsent: false })
      .where(eq(schema.unit.id, f.unitId));
    const next = await f.period(2, 600);
    const b = await finalizeBillingPeriod(next);
    expect(b.byUnit[f.unitId].totalRial).toBe(400);
    expect(
      (
        await db.query.unitInvoice.findFirst({
          where: eq(schema.unitInvoice.id, originalInvoice!.id),
        })
      )?.subtotalRial,
    ).toBe(100);
    expect(
      (
        await db.query.periodSnapshot.findFirst({
          where: eq(schema.periodSnapshot.id, snapshot!.id),
        })
      )?.temporarilyAbsent,
    ).toBe(true);
  });

  it("does not silently discard a water bill when every household is temporarily absent", async () => {
    const f = await fixture();
    await db
      .update(schema.unit)
      .set({ temporarilyAbsent: true })
      .where(eq(schema.unit.id, f.unitId));
    const id = await f.period(1, 100);
    await expect(finalizeBillingPeriod(id)).rejects.toThrow("بدون سهم");
    expect(
      (
        await db.query.billingPeriod.findFirst({
          where: eq(schema.billingPeriod.id, id),
        })
      )?.status,
    ).toBe("draft");
    expect(
      await db
        .select()
        .from(schema.unitInvoice)
        .where(eq(schema.unitInvoice.periodId, id)),
    ).toHaveLength(0);
  });
  it("issues two periods without adding old debt into the second invoice", async () => {
    const f = await fixture();
    const a = await f.period(1, 100);
    await finalizeBillingPeriod(a);
    const b = await f.period(2, 200);
    await finalizeBillingPeriod(b);
    const invoices = await db
      .select()
      .from(schema.unitInvoice)
      .where(eq(schema.unitInvoice.unitId, f.unitId));
    expect(invoices.reduce((s, i) => s + i.balanceRial, 0)).toBe(300);
    expect(invoices.find((i) => i.periodId === b)?.totalRial).toBe(200);
    expect(invoices.find((i) => i.periodId === b)?.previousBalanceRial).toBe(
      100,
    );
  });
  it("consumes prepayment across future invoices only once", async () => {
    const f = await fixture();
    await db.insert(schema.payment).values({
      id: crypto.randomUUID(),
      buildingId: f.buildingId,
      unitId: f.unitId,
      amountRial: 150,
      method: "bank_transfer",
      paidAt: new Date(),
    });
    const a = await f.period(1, 100);
    await finalizeBillingPeriod(a);
    const b = await f.period(2, 100);
    await finalizeBillingPeriod(b);
    const invoices = await db
      .select()
      .from(schema.unitInvoice)
      .where(eq(schema.unitInvoice.unitId, f.unitId));
    expect(invoices.reduce((s, i) => s + i.paidRial, 0)).toBe(150);
    expect(invoices.reduce((s, i) => s + i.balanceRial, 0)).toBe(50);
  });
  it("rejects repeated finalization without duplicating invoices", async () => {
    const f = await fixture();
    const id = await f.period(1, 100);
    await finalizeBillingPeriod(id);
    await expect(finalizeBillingPeriod(id)).rejects.toThrow();
    expect(
      (
        await db
          .select()
          .from(schema.unitInvoice)
          .where(eq(schema.unitInvoice.periodId, id))
      ).length,
    ).toBe(1);
  });
  it("rolls back when a water expense has no eligible residents", async () => {
    const f = await fixture(true);
    const id = await f.period(1, 100);
    await expect(finalizeBillingPeriod(id)).rejects.toThrow();
    expect(
      (
        await db.query.billingPeriod.findFirst({
          where: eq(schema.billingPeriod.id, id),
        })
      )?.status,
    ).toBe("draft");
    expect(
      await db
        .select()
        .from(schema.unitInvoice)
        .where(eq(schema.unitInvoice.periodId, id)),
    ).toHaveLength(0);
  });
  it("normalizes quarterly history and excludes newer drafts from recommendations", async () => {
    const f = await fixture();
    const id = await f.period(1, 900, 3);
    await finalizeBillingPeriod(id);
    await f.period(4, 90000);
    await db
      .update(schema.expenseCategory)
      .set({ inflationPercent: -10 })
      .where(eq(schema.expenseCategory.id, f.categoryId));
    const result = await computeChargeRecommendation(f.buildingId, 3);
    expect(result.coveredMonths).toBe(3);
    expect(result.suggestedMonthlyRial).toBe(270);
  });
});

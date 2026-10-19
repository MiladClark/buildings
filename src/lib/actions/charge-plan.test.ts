import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFile, readdir, mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
const auth = vi.hoisted(() => ({ manager: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireManager: auth.manager }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/lib/db/schema");
  const folder = await mkdtemp(join(tmpdir(), "hamkhane-plan-test-"));
  const client = createClient({ url: `file:${join(folder, "test.db")}` });
  return { db: drizzle(client, { schema }), client, folder };
});
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { saveChargeBudget, saveManualMonthlyCharge } from "./charge-plan";
import { getFinanceData } from "@/lib/queries/finance";
import { getPeriodChargePlan } from "@/lib/queries/charge-plan";

const buildingId = "plan-building",
  other = "other-building",
  periodId = "plan-period",
  actorId = "plan-manager",
  categoryId = "plan-power",
  expenseId = "plan-bill";
beforeAll(async () => {
  const { client } = (await import("@/lib/db")) as unknown as {
    client: import("@libsql/client").Client;
  };
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const statement of (await readFile(`drizzle/${file}`, "utf8")).split(
      "--> statement-breakpoint",
    ))
      if (statement.trim()) await client.execute(statement);
  await db
    .insert(s.user)
    .values({ id: actorId, name: "مدیر آزمایشی", email: "plan@test.local" });
  await db.insert(s.building).values([
    { id: buildingId, name: "آزمایش" },
    { id: other, name: "دیگر" },
  ]);
  await db.insert(s.unit).values({
    id: "plan-unit",
    buildingId,
    label: "۱",
    occupantCount: 2,
    status: "occupied",
  });
  await db.insert(s.billingPeriod).values([
    {
      id: periodId,
      buildingId,
      title: "مهر",
      periodType: "monthly",
      startDate: new Date("2026-09-23"),
      endDate: new Date("2026-10-22"),
    },
    {
      id: "foreign-period",
      buildingId: other,
      title: "دیگر",
      periodType: "monthly",
      startDate: new Date("2026-09-23"),
      endDate: new Date("2026-10-22"),
    },
  ]);
  await db.insert(s.expenseCategory).values([
    {
      id: categoryId,
      buildingId,
      name: "برق",
      slug: "common-electricity",
      allocationMethod: "per_unit",
    },
    {
      id: "plan-water",
      buildingId,
      name: "آب",
      slug: "water",
      allocationMethod: "per_person",
    },
    {
      id: "foreign-category",
      buildingId: other,
      name: "دیگر",
      slug: "cleaning",
      allocationMethod: "per_unit",
    },
  ]);
  await db.insert(s.expenseLine).values([
    {
      id: expenseId,
      periodId,
      categoryId,
      amountRial: 1600000,
      expenseDate: new Date("2026-10-01"),
    },
    {
      id: "foreign-expense",
      periodId: "foreign-period",
      categoryId: "foreign-category",
      amountRial: 1000000,
      expenseDate: new Date("2026-10-01"),
    },
  ]);
});
beforeEach(() => {
  auth.manager.mockReset();
  auth.manager.mockResolvedValue({
    member: { buildingId, role: "manager" },
    session: { user: { id: actorId } },
  });
});
afterAll(async () => {
  const { client, folder } = (await import("@/lib/db")) as unknown as {
    client: import("@libsql/client").Client;
    folder: string;
  };
  client.close();
  const file = join(folder, "test.db");
  await Promise.allSettled(
    [file, `${file}-wal`, `${file}-shm`].map((p) => unlink(p)),
  );
  await rmdir(folder).catch(() => {});
});
const payload = {
  bufferPercent: 10,
  roundToRial: 500000,
  policies: [
    {
      categoryId,
      mode: "bill" as const,
      intervalMonths: 3,
      monthlyReserveRial: null,
    },
  ],
  coverage: [{ expenseId, months: 2 }],
};
describe("charge plan persistence and authorization", () => {
  it("saves budget assumptions and a manual amount without creating any real financial entries", async () => {
    await saveManualMonthlyCharge(periodId, 3000000);
    await saveChargeBudget(periodId, payload);
    const ledger = await getFinanceData(buildingId);
    const plan = await getPeriodChargePlan(buildingId, periodId, ledger);
    expect(plan.manualMonthlyRial).toBe(3000000);
    expect(plan.monthlyBuildingRial).toBe(800000);
    expect(plan.complete).toBe(true);
    expect(ledger.invoices).toHaveLength(0);
    expect(ledger.payments).toHaveLength(0);
    expect(ledger.expenses[0].expense.amountRial).toBe(1600000);
    await saveManualMonthlyCharge(periodId, null);
    expect(
      (
        await db.query.periodChargePlan.findFirst({
          where: eq(s.periodChargePlan.periodId, periodId),
        })
      )?.bufferPercent,
    ).toBe(10);
  });
  it("rejects a period or expense from another building without changing any policy", async () => {
    await expect(
      saveManualMonthlyCharge("foreign-period", 3000000),
    ).rejects.toThrow("دوره");
    await expect(
      saveChargeBudget(periodId, {
        ...payload,
        coverage: [{ expenseId: "foreign-expense", months: 1 }],
      }),
    ).rejects.toThrow("قبض");
    expect(
      (
        await db.query.expenseLine.findFirst({
          where: eq(s.expenseLine.id, "foreign-expense"),
        })
      )?.coverageMonths,
    ).toBeNull();
  });
  it("keeps person-based water outside a uniform per-unit base", async () => {
    await expect(
      saveChargeBudget(periodId, {
        ...payload,
        policies: [
          {
            categoryId: "plan-water",
            mode: "monthly",
            intervalMonths: null,
            monthlyReserveRial: null,
          },
        ],
      }),
    ).rejects.toThrow("نفرمحور");
  });
  it("rejects malformed durations, duplicate entries, unsafe money and invalid percentages", async () => {
    await expect(
      saveChargeBudget(periodId, { ...payload, bufferPercent: -1 }),
    ).rejects.toThrow("نوسان");
    await expect(
      saveChargeBudget(periodId, {
        ...payload,
        coverage: [{ expenseId, months: 0 }],
      }),
    ).rejects.toThrow("بازه");
    await expect(
      saveChargeBudget(periodId, {
        ...payload,
        policies: [...payload.policies, ...payload.policies],
      }),
    ).rejects.toThrow("تکراری");
    await expect(saveManualMonthlyCharge(periodId, Infinity)).rejects.toThrow(
      "مبلغ",
    );
    await expect(saveManualMonthlyCharge(periodId, -1)).rejects.toThrow("مبلغ");
  });
  it("requires manager authorization for both kinds of save", async () => {
    auth.manager.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(saveManualMonthlyCharge(periodId, 1)).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(saveChargeBudget(periodId, payload)).rejects.toThrow(
      "FORBIDDEN",
    );
  });
});

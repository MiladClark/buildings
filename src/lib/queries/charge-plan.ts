import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chargeBudgetPolicy, periodChargePlan } from "@/lib/db/schema";
import type { FinanceData } from "./finance";
import { calculatePeriodChargePlan } from "@/lib/billing/charge-plan";

export async function getPeriodChargePlan(
  buildingId: string,
  periodId: string,
  data: FinanceData,
) {
  const target = data.periods.find(
    (p) => p.id === periodId && p.buildingId === buildingId,
  );
  if (!target) throw new Error("دوره پیدا نشد.");
  const [policies, plan] = await Promise.all([
    db
      .select()
      .from(chargeBudgetPolicy)
      .where(eq(chargeBudgetPolicy.buildingId, buildingId)),
    db.query.periodChargePlan.findFirst({
      where: eq(periodChargePlan.periodId, periodId),
    }),
  ]);
  const settings = {
    bufferPercent: plan?.bufferPercent ?? 10,
    roundToRial: plan?.roundToRial ?? 500000,
    manualMonthlyRial: plan?.manualMonthlyRial ?? null,
  };
  return {
    ...settings,
    ...calculatePeriodChargePlan({
      target,
      periods: data.periods,
      categories: data.categories,
      expenses: data.expenses.map((r) => r.expense),
      policies,
      unitCount: data.units.filter((u) => !u.deletedAt).length,
      ...settings,
    }),
  };
}
export type PeriodChargePlanning = Awaited<
  ReturnType<typeof getPeriodChargePlan>
>;

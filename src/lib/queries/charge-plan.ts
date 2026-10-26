import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { periodChargePlan } from "@/lib/db/schema";
import type { FinanceData } from "./finance";
import { smartChargePlan } from "@/lib/billing/smart-charge-plan";
import {
  costCoveredByCharge,
  usesChargeFund,
} from "@/lib/billing/charge-model";
import { jalaliMonthSpan } from "@/lib/format/jalali";

export async function getPeriodChargePlan(
  buildingId: string,
  periodId: string,
  data: FinanceData,
) {
  const target = data.periods.find(
    (p) => p.id === periodId && p.buildingId === buildingId,
  );
  if (!target) throw new Error("دوره پیدا نشد.");
  const plan = await db.query.periodChargePlan.findFirst({
    where: eq(periodChargePlan.periodId, periodId),
  });
  const fund = usesChargeFund(target, plan?.manualMonthlyRial);
  const currentCosts = data.expenses.filter(
    (r) => r.expense.periodId === periodId && !r.expense.deletedAt,
  );
  const coveredRial = currentCosts
    .filter((r) => costCoveredByCharge(r.category, r.expense, fund))
    .reduce((s, r) => s + r.expense.amountRial, 0);
  const shares = data.settlement.shares.filter((s) => s.periodId === periodId);
  const chargeTotalRial = shares
    .filter((s) => s.categoryId === `monthly-charge:${buildingId}`)
    .reduce((s, r) => s + r.amountRial, 0);
  return {
    manualMonthlyRial: plan?.manualMonthlyRial ?? null,
    fund,
    coveredRial,
    chargeTotalRial,
    budgetRemainingRial: chargeTotalRial - coveredRial,
    payableRial: shares.reduce((s, r) => s + r.amountRial, 0),
    periodMonths: jalaliMonthSpan(target.startDate, target.endDate),
    ...smartChargePlan({
      categories: data.categories,
      expenses: [
        ...data.expenses
          .filter(
            (r) =>
              !data.periods.find((p) => p.id === r.expense.periodId)?.deletedAt,
          )
          .map((r) => r.expense),
        ...data.standaloneExpenses.filter((e) => !e.linkedExpenseId),
      ],
      unitCount: data.units.filter((u) => !u.deletedAt).length,
      cleaningVisitRial: plan?.cleaningVisitRial,
      cleaningEveryDays: plan?.cleaningEveryDays,
    }),
  };
}
export type PeriodChargePlanning = Awaited<
  ReturnType<typeof getPeriodChargePlan>
>;

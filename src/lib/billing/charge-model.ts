import type { CategoryInput, ExpenseInput } from "./types";
import type { SettlementData } from "./settlement-state";
export const baseChargeSlug = "period-monthly-charge";
export const baseChargeId = (buildingId: string) =>
  `monthly-charge:${buildingId}`;

export function usesChargeFund(
  period: { status: string; chargeModel?: string },
  monthlyRial?: number | null,
) {
  return period.status === "draft"
    ? monthlyRial != null
    : period.chargeModel === "fund";
}

export function costCoveredByCharge(
  category: { allocationMethod: string; slug?: string } | undefined,
  expense: { billingTreatment?: string },
  fund: boolean,
) {
  return (
    fund &&
    !!category &&
    category.slug !== baseChargeSlug &&
    category.allocationMethod !== "per_person" &&
    category.allocationMethod !== "excluded" &&
    expense.billingTreatment !== "separate"
  );
}

/** Expenses remain in the building ledger; only separate assessments become unit debts. */
export function receivableExpenses<
  C extends CategoryInput & { slug?: string },
  E extends ExpenseInput & { billingTreatment?: string },
>(categories: C[], expenses: E[], fund: boolean): E[] {
  return expenses.filter(
    (expense) =>
      !costCoveredByCharge(
        categories.find((c) => c.id === expense.categoryId),
        expense,
        fund,
      ),
  );
}

export function paymentDestination(
  data: SettlementData,
  payment: {
    periodId?: string | null;
    categoryId?: string | null;
    standaloneExpenseId?: string | null;
  },
) {
  const period = data.periods.find((p) => p.id === payment.periodId);
  const category = data.categories.find((c) => c.id === payment.categoryId);
  if (
    !period ||
    !category ||
    !usesChargeFund(
      period,
      data.chargePlans?.find((p) => p.periodId === period.id)
        ?.manualMonthlyRial,
    )
  )
    return payment.categoryId;
  const source = data.standaloneExpenses?.find(
    (c) => c.id === payment.standaloneExpenseId,
  );
  const linked = source
    ? data.expenses.find((e) => e.id === source.linkedExpenseId)
    : undefined;
  const explicitlySeparate = linked
    ? linked.billingTreatment === "separate"
    : data.expenses.some(
        (e) =>
          e.periodId === period.id &&
          e.categoryId === category.id &&
          e.billingTreatment === "separate",
      );
  return costCoveredByCharge(
    category,
    { billingTreatment: explicitlySeparate ? "separate" : "auto" },
    true,
  )
    ? baseChargeId(period.buildingId)
    : payment.categoryId;
}

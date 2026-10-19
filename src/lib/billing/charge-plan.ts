import { jalaliMonthSpan, isoDate } from "@/lib/format/jalali";

export const budgetModes = [
  "monthly",
  "bill",
  "reserve",
  "separate",
  "one_off",
] as const;
export type BudgetMode = (typeof budgetModes)[number];
export type BudgetPolicy = {
  categoryId: string;
  mode: BudgetMode;
  intervalMonths: number | null;
  monthlyReserveRial: number | null;
};
type Category = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  allocationMethod: string;
  fixedMonthlyAmount: number | null;
};
type Period = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  deletedAt?: Date | null;
};
type Expense = {
  id: string;
  periodId: string;
  categoryId: string;
  amountRial: number;
  expenseDate: Date;
  coverageMonths: number | null;
  deletedAt?: Date | null;
};

export function defaultBudgetPolicy(
  category: Pick<Category, "id" | "slug" | "allocationMethod">,
): BudgetPolicy {
  const mode =
    category.allocationMethod === "per_person"
      ? "separate"
      : ["equipment", "supplies", "repairs"].includes(category.slug)
        ? "one_off"
        : ["elevator", "lift"].includes(category.slug)
          ? "reserve"
          : ["electricity", "common-electricity", "electric", "water"].includes(
                category.slug,
              )
            ? "bill"
            : "monthly";
  return {
    categoryId: category.id,
    mode,
    intervalMonths: null,
    monthlyReserveRial: null,
  };
}

export function calculatePeriodChargePlan(input: {
  target: Period;
  periods: Period[];
  categories: Category[];
  expenses: Expense[];
  policies: BudgetPolicy[];
  unitCount: number;
  bufferPercent: number;
  roundToRial: number;
}) {
  const targetEnd = isoDate(input.target.endDate);
  const eligiblePeriods = input.periods.filter(
    (p) =>
      !p.deletedAt &&
      isoDate(p.startDate) <= targetEnd &&
      (p.id === input.target.id || isoDate(p.endDate) <= targetEnd),
  );
  const periodIds = new Set(eligiblePeriods.map((p) => p.id));
  const expenses = input.expenses.filter(
    (e) =>
      !e.deletedAt &&
      periodIds.has(e.periodId) &&
      isoDate(e.expenseDate) <= targetEnd,
  );
  const breakdown = input.categories
    .filter((c) => c.active && c.allocationMethod !== "excluded")
    .map((category) => {
      const policy =
        input.policies.find((p) => p.categoryId === category.id) ??
        defaultBudgetPolicy(category);
      const records = expenses
        .filter((e) => e.categoryId === category.id)
        .toSorted(
          (a, b) =>
            b.expenseDate.getTime() - a.expenseDate.getTime() ||
            b.id.localeCompare(a.id),
        );
      let monthlyRial = 0,
        samples = 0,
        missing = false;
      if (policy.mode === "reserve") {
        missing = policy.monthlyReserveRial === null;
        monthlyRial = policy.monthlyReserveRial ?? 0;
      } else if (policy.mode === "bill") {
        const bills = records.slice(0, 6);
        samples = bills.length;
        missing = bills.some(
          (e) => !(e.coverageMonths ?? policy.intervalMonths),
        );
        const known = bills.filter(
          (e) => (e.coverageMonths ?? policy.intervalMonths ?? 0) > 0,
        );
        const months = known.reduce(
          (sum, e) => sum + (e.coverageMonths ?? policy.intervalMonths ?? 0),
          0,
        );
        monthlyRial = months
          ? Math.round(known.reduce((sum, e) => sum + e.amountRial, 0) / months)
          : 0;
      } else if (policy.mode === "monthly") {
        if (category.allocationMethod === "fixed_per_unit") {
          monthlyRial = (category.fixedMonthlyAmount ?? 0) * input.unitCount;
        } else {
          // Latest monthly cost reflects the current cleaning rate; visits in that period are summed.
          const periods = eligiblePeriods
            .filter((p) => records.some((e) => e.periodId === p.id))
            .toSorted(
              (a, b) =>
                Number(b.id === input.target.id) -
                  Number(a.id === input.target.id) ||
                b.startDate.getTime() - a.startDate.getTime() ||
                b.endDate.getTime() - a.endDate.getTime(),
            )
            .slice(0, 1);
          const ids = new Set(periods.map((p) => p.id));
          samples = periods.length;
          const months = periods.reduce(
            (sum, p) => sum + jalaliMonthSpan(p.startDate, p.endDate),
            0,
          );
          monthlyRial = months
            ? Math.round(
                records
                  .filter((e) => ids.has(e.periodId))
                  .reduce((sum, e) => sum + e.amountRial, 0) / months,
              )
            : 0;
        }
      }
      return {
        categoryId: category.id,
        name: category.name,
        perPerson: category.allocationMethod === "per_person",
        policy,
        monthlyRial,
        samples,
        missing,
        recordCount: records.length,
        expenses: records.slice(0, 6),
      };
    });
  const monthlyBuildingRial = breakdown.reduce(
    (sum, b) => sum + b.monthlyRial,
    0,
  );
  const withBufferRial = Math.round(
    monthlyBuildingRial * (1 + input.bufferPercent / 100),
  );
  const calculatedPerUnitRial = input.unitCount
    ? Math.ceil(withBufferRial / input.unitCount)
    : 0;
  const suggestedMonthlyRial =
    Math.ceil(calculatedPerUnitRial / input.roundToRial) * input.roundToRial;
  const missingCategories = breakdown
    .filter((b) => b.missing)
    .map((b) => b.name);
  return {
    breakdown,
    monthlyBuildingRial,
    withBufferRial,
    suggestedMonthlyRial,
    unitCount: input.unitCount,
    periodMonths: jalaliMonthSpan(input.target.startDate, input.target.endDate),
    complete:
      input.unitCount > 0 &&
      missingCategories.length === 0 &&
      monthlyBuildingRial > 0,
    missingCategories,
    preliminary: breakdown.some(
      (b) =>
        ["monthly", "bill"].includes(b.policy.mode) &&
        b.samples < 3 &&
        b.recordCount > 0,
    ),
  };
}

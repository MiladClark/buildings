import { formatJalaliDate, jalaliMonthSpan } from "@/lib/format/jalali";

export type PeriodExpensesReport = {
  buildingName: string;
  periodTitle: string;
  startDate: string;
  endDate: string;
  statusLabel: string;
  draft: boolean;
  totalRial: number;
  manualMonthlyRial?: number | null;
  unitCount: number;
  periodMonths: number;
  chargeTotalRial: number | null;
  grandTotalRial: number;
  fund: boolean;
  separateTotalRial: number;
  coveredTotalRial: number;
  items: {
    description: string;
    category: string;
    date: string;
    amountRial: number;
    fundingLabel?: string;
  }[];
};

export function buildPeriodExpensesReport(source: {
  buildingName: string;
  manualMonthlyRial?: number | null;
  unitCount?: number;
  chargeTotalRial?: number;
  fund?: boolean;
  payableTotalRial?: number;
  period: {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    status: "draft" | "finalized" | "archived";
  };
  expenses: {
    periodId: string;
    description: string | null;
    category: string;
    expenseDate: Date;
    amountRial: number;
    deletedAt?: Date | null;
    coveredByCharge?: boolean;
  }[];
}): PeriodExpensesReport {
  const items = source.expenses
    .filter(
      (expense) => expense.periodId === source.period.id && !expense.deletedAt,
    )
    .toSorted((a, b) => b.expenseDate.getTime() - a.expenseDate.getTime())
    .map((expense) => ({
      description: expense.description?.trim() || expense.category,
      category: expense.category,
      date: formatJalaliDate(expense.expenseDate),
      amountRial: expense.amountRial,
      fundingLabel: source.fund
        ? expense.coveredByCharge
          ? "از محل شارژ"
          : "دریافت جداگانه"
        : undefined,
    }));
  const totalRial = items.reduce(
    (total, expense) => total + expense.amountRial,
    0,
  );
  const unitCount = source.unitCount ?? 0;
  const periodMonths = jalaliMonthSpan(
    source.period.startDate,
    source.period.endDate,
  );
  const chargeTotalRial =
    source.chargeTotalRial ??
    (source.manualMonthlyRial == null
      ? null
      : source.manualMonthlyRial * unitCount * periodMonths);
  const coveredTotalRial = source.expenses
    .filter(
      (e) =>
        e.periodId === source.period.id && !e.deletedAt && e.coveredByCharge,
    )
    .reduce((s, e) => s + e.amountRial, 0);
  const separateTotalRial = totalRial - coveredTotalRial;
  return {
    buildingName: source.buildingName,
    periodTitle: source.period.title,
    startDate: formatJalaliDate(source.period.startDate),
    endDate: formatJalaliDate(source.period.endDate),
    statusLabel: {
      draft: "پیش‌نویس",
      finalized: "نهایی‌شده",
      archived: "بایگانی‌شده",
    }[source.period.status],
    draft: source.period.status === "draft",
    totalRial,
    unitCount,
    periodMonths,
    chargeTotalRial,
    fund: source.fund ?? false,
    coveredTotalRial,
    separateTotalRial,
    grandTotalRial:
      source.payableTotalRial ??
      (source.fund ? separateTotalRial : totalRial) + (chargeTotalRial ?? 0),
    manualMonthlyRial: source.manualMonthlyRial ?? null,
    items,
  };
}

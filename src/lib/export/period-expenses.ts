import { formatJalaliDate } from "@/lib/format/jalali";

export type PeriodExpensesReport = {
  buildingName: string;
  periodTitle: string;
  startDate: string;
  endDate: string;
  statusLabel: string;
  draft: boolean;
  totalRial: number;
  manualMonthlyRial?: number | null;
  items: {
    description: string;
    category: string;
    date: string;
    amountRial: number;
  }[];
};

export function buildPeriodExpensesReport(source: {
  buildingName: string;
  manualMonthlyRial?: number | null;
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
    }));
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
    totalRial: items.reduce((total, expense) => total + expense.amountRial, 0),
    manualMonthlyRial: source.manualMonthlyRial ?? null,
    items,
  };
}

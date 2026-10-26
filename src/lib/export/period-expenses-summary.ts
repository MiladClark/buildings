import type { PeriodExpensesReport } from "./period-expenses";
import { formatToman, toPersianDigits as fa } from "@/lib/format/money";
export function periodExpenseSummaries(report: PeriodExpensesReport) {
  const rows: {
    label: string;
    amount: number;
    note?: string;
    strong?: boolean;
  }[] = [
    {
      label: "جمع هزینه‌های ثبت‌شده",
      amount: report.totalRial,
      note: report.fund
        ? "هزینه‌های «از محل شارژ» دوباره به مبلغ قابل پرداخت اضافه نمی‌شوند."
        : undefined,
    },
  ];
  if (report.manualMonthlyRial != null || (report.chargeTotalRial ?? 0) > 0)
    rows.push({
      label:
        report.manualMonthlyRial != null
          ? "شارژ ماهانه هر واحد"
          : "جمع شارژ دوره",
      amount: report.manualMonthlyRial ?? report.chargeTotalRial ?? 0,
      note: `جمع شارژ دوره: ${formatToman(report.chargeTotalRial ?? 0)} · ${fa(String(report.unitCount))} واحد · ${fa(String(report.periodMonths))} ماه`,
    });
  if (report.fund)
    rows.push({
      label: "آب و هزینه‌های جداگانه",
      amount: report.separateTotalRial,
    });
  rows.push({
    label: "جمع قابل پرداخت واحدها",
    amount: report.grandTotalRial,
    strong: true,
  });
  return rows;
}

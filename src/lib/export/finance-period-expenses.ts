import type { FinanceData } from "@/lib/queries/finance";
import { buildPeriodExpensesReport } from "./period-expenses";
import { monthlyChargeCategoryId } from "@/lib/billing/monthly-charge";
import { jalaliMonthSpan } from "@/lib/format/jalali";
import {
  costCoveredByCharge,
  usesChargeFund,
} from "@/lib/billing/charge-model";
export function financePeriodExpensesReport(
  data: FinanceData,
  period: FinanceData["periods"][number],
  manualMonthlyRial?: number | null,
) {
  const issuedInvoiceIds = new Set(
    data.invoices
      .filter((row) => row.invoice.periodId === period.id)
      .map((row) => row.invoice.id),
  );
  const issuedLines = data.invoiceLines.filter((line) =>
    issuedInvoiceIds.has(line.invoiceId),
  );
  const charges =
    period.status !== "draft"
      ? issuedLines.filter((line) => line.basis?.includes("مبلغ ثابت واحد"))
      : data.settlement.shares.filter(
          (share) =>
            share.periodId === period.id &&
            data.categories.some(
              (category) =>
                category.id === share.categoryId &&
                category.allocationMethod === "fixed_per_unit",
            ),
        );
  const variableCategoryIds = new Set(
    issuedLines
      .filter((line) => !line.basis?.includes("مبلغ ثابت واحد"))
      .map((line) => line.categoryId),
  );
  const monthly = charges.find(
    (share) => share.categoryId === monthlyChargeCategoryId(period.buildingId),
  );
  const monthlyRial =
    period.status === "draft"
      ? (manualMonthlyRial ?? null)
      : monthly
        ? monthly.amountRial / jalaliMonthSpan(period.startDate, period.endDate)
        : null;
  const fund = usesChargeFund(period, manualMonthlyRial);
  const receivables =
    period.status === "draft"
      ? data.settlement.shares.filter((s) => s.periodId === period.id)
      : issuedLines;
  return buildPeriodExpensesReport({
    buildingName: data.settings!.name,
    manualMonthlyRial: monthlyRial,
    fund,
    payableTotalRial: receivables.reduce((s, r) => s + r.amountRial, 0),
    chargeTotalRial: charges.reduce((sum, share) => sum + share.amountRial, 0),
    unitCount:
      period.status === "draft"
        ? data.units.filter((unit) => !unit.deletedAt).length
        : data.invoices.filter((row) => row.invoice.periodId === period.id)
            .length,
    period,
    expenses: data.expenses
      .filter(({ category }) =>
        fund
          ? category.allocationMethod !== "excluded"
          : period.status === "draft"
            ? !["fixed_per_unit", "excluded"].includes(
                category.allocationMethod,
              )
            : variableCategoryIds.has(category.id),
      )
      .map(({ expense, category }) => ({
        ...expense,
        category: category.name,
        coveredByCharge: costCoveredByCharge(category, expense, fund),
      })),
  });
}

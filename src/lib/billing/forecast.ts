import { allocatePeriodCharges } from "./engine";
import { jalaliMonthSpan } from "@/lib/format/jalali";
import { paysUnitCharges } from "./occupancy";
import type { SettlementData } from "./settlement-state";
import type { AllocationMethod, UnitSnapshot } from "./types";

export function calculateChargeRecommendation(
  data: Pick<
    SettlementData,
    "units" | "periods" | "categories" | "expenses" | "settings"
  >,
  monthsWindow: number,
) {
  if (!Number.isInteger(monthsWindow) || monthsWindow < 1 || monthsWindow > 24)
    throw new Error("بازه بررسی معتبر نیست.");
  const issued = data.periods
    .filter((p) => !p.deletedAt && p.status !== "draft")
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
  let coveredMonths = 0;
  const ids = new Set<string>();
  for (const p of issued) {
    if (coveredMonths >= monthsWindow) break;
    ids.add(p.id);
    coveredMonths += jalaliMonthSpan(p.startDate, p.endDate);
  }
  if (!ids.size)
    throw new Error("برای پیشنهاد شارژ، حداقل یک دوره را نهایی کنید.");
  const units = data.units.filter((u) => !u.deletedAt);
  const breakdown = data.categories
    .filter((c) => c.active && c.allocationMethod !== "excluded")
    .map((c) => {
      const fixed = c.allocationMethod === "fixed_per_unit";
      const total = data.expenses
        .filter(
          (e) => !e.deletedAt && ids.has(e.periodId) && e.categoryId === c.id,
        )
        .reduce((s, e) => s + e.amountRial, 0);
      const averageRial = fixed
        ? (c.fixedMonthlyAmount ?? 0) *
          units.filter((u) =>
            paysUnitCharges(
              u,
              c.includeEmptyUnits || !!data.settings?.perUnitIncludeEmpty,
            ),
          ).length
        : Math.round(total / coveredMonths);
      return {
        categoryId: c.id,
        name: c.name,
        averageRial,
        inflationPercent: c.inflationPercent ?? 0,
        adjustedRial: Math.round(
          averageRial * Math.max(0, 1 + (c.inflationPercent ?? 0) / 100),
        ),
        method: c.allocationMethod,
        includeEmpty:
          c.includeEmptyUnits || !!data.settings?.perUnitIncludeEmpty,
        source: fixed ? ("fixed" as const) : ("history" as const),
      };
    });
  return {
    breakdown,
    coveredMonths,
    suggestedMonthlyRial: breakdown.reduce((s, c) => s + c.adjustedRial, 0),
  };
}

export type ForecastCategory = {
  categoryId: string;
  name: string;
  averageRial: number;
  inflationPercent: number;
  method: AllocationMethod;
  includeEmpty: boolean;
};
/** Projections use the invoice engine's absence rules and exact remainders. */
export function allocateChargeForecast(
  units: UnitSnapshot[],
  categories: ForecastCategory[],
  adjustment: number,
  reserve: number,
) {
  const adjusted = categories.map((c) => ({
    ...c,
    adjusted: Math.round(
      c.averageRial * Math.max(0, 1 + (c.inflationPercent + adjustment) / 100),
    ),
  }));
  const total = adjusted.reduce((s, c) => s + c.adjusted, 0);
  const withReserve = Math.round(total * (1 + reserve / 100));
  let allocated = 0;
  const expenses = adjusted.map((c, index) => {
    const cumulative = adjusted
      .slice(0, index + 1)
      .reduce((s, r) => s + r.adjusted, 0);
    const target =
      total > 0 ? Math.round((cumulative * withReserve) / total) : 0;
    const amountRial = target - allocated;
    allocated = target;
    return { categoryId: c.categoryId, amountRial };
  });
  const preview = allocatePeriodCharges(
    units,
    categories.map((c) => ({
      id: c.categoryId,
      name: c.name,
      allocationMethod: c.method === "fixed_per_unit" ? "per_unit" : c.method,
      includeEmptyUnits: c.includeEmpty,
    })),
    expenses,
    { perUnitIncludeEmpty: false },
  );
  return {
    adjusted,
    total,
    withReserve,
    preview,
    unallocatedRial:
      withReserve - preview.lines.reduce((s, l) => s + l.amountRial, 0),
  };
}

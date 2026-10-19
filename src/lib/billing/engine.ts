import type {
  AllocationPreview,
  BuildingAllocationSettings,
  CategoryInput,
  ExpenseInput,
  UnitAllocationLine,
  UnitSnapshot,
} from "./types";
import { toPersianDigits } from "@/lib/format/money";
import { effectiveOccupants, paysUnitCharges } from "./occupancy";
import { perUnitBasis } from "@/lib/format/allocation-basis";

function countsForPerUnit(
  units: UnitSnapshot[],
  includeEmpty: boolean,
  building: BuildingAllocationSettings,
): number {
  return units.filter((u) =>
    paysUnitCharges(u, includeEmpty || building.perUnitIncludeEmpty),
  ).length;
}

function distributeRemainder(
  total: number,
  weights: { unitId: string; weight: number }[],
): Record<string, number> {
  const weightSum = weights.reduce((s, w) => s + w.weight, 0);
  if (weightSum <= 0 || total <= 0) {
    return Object.fromEntries(weights.map((w) => [w.unitId, 0]));
  }

  const raw = weights.map((w) => ({
    unitId: w.unitId,
    exact: (total * w.weight) / weightSum,
  }));

  const floors = raw.map((r) => ({
    unitId: r.unitId,
    amount: Math.floor(r.exact),
    frac: r.exact - Math.floor(r.exact),
  }));

  let remainder = total - floors.reduce((s, f) => s + f.amount, 0);
  const sorted = [...floors].sort((a, b) => b.frac - a.frac);
  const result: Record<string, number> = {};
  for (const f of floors) {
    result[f.unitId] = f.amount;
  }
  let i = 0;
  while (remainder > 0 && sorted.length > 0) {
    result[sorted[i % sorted.length].unitId] += 1;
    remainder -= 1;
    i += 1;
  }
  return result;
}

export function allocatePeriodCharges(
  units: UnitSnapshot[],
  categories: CategoryInput[],
  expenses: ExpenseInput[],
  building: BuildingAllocationSettings,
): AllocationPreview {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const lines: UnitAllocationLine[] = [];

  const expensesByCategory = new Map<string, number>();
  for (const e of expenses) {
    expensesByCategory.set(
      e.categoryId,
      (expensesByCategory.get(e.categoryId) ?? 0) + e.amountRial,
    );
  }

  const totalOccupants = units.reduce((s, u) => s + effectiveOccupants(u), 0);
  for (const category of categories) {
    if (
      category.allocationMethod === "fixed_per_unit" &&
      (category.fixedMonthlyAmount ?? 0) > 0 &&
      !expensesByCategory.has(category.id)
    ) {
      expensesByCategory.set(category.id, category.fixedMonthlyAmount!);
    }
  }

  for (const [categoryId, amount] of expensesByCategory) {
    const category = categoryMap.get(categoryId);
    if (!category || category.allocationMethod === "excluded" || amount <= 0) {
      continue;
    }

    if (category.allocationMethod === "per_person") {
      if (totalOccupants <= 0) continue;
      const shares = distributeRemainder(
        amount,
        units.map((u) => ({ unitId: u.unitId, weight: effectiveOccupants(u) })),
      );
      for (const unit of units) {
        const occ = effectiveOccupants(unit);
        if (occ <= 0 && !unit.temporarilyAbsent) continue;
        const unitAmount = shares[unit.unitId];
        lines.push({
          unitId: unit.unitId,
          categoryId,
          categoryName: category.name,
          amountRial: unitAmount,
          basis: unit.temporarilyAbsent
            ? "غیبت موقت · ۰ نفر حاضر · معاف از هزینه نفرمحور"
            : `${toPersianDigits(String(occ))} نفر`,
        });
      }
      continue;
    }

    if (category.allocationMethod === "fixed_per_unit") {
      const fixed = Math.round(
        (category.fixedMonthlyAmount ?? 0) * (building.periodMonths ?? 1),
      );
      for (const unit of units) {
        if (
          !paysUnitCharges(
            unit,
            category.includeEmptyUnits || building.perUnitIncludeEmpty,
          )
        )
          continue;
        lines.push({
          unitId: unit.unitId,
          categoryId,
          categoryName: category.name,
          amountRial: fixed,
          basis: "مبلغ ثابت واحد",
        });
      }
      continue;
    }

    if (category.allocationMethod === "per_unit") {
      const denom = countsForPerUnit(
        units,
        category.includeEmptyUnits,
        building,
      );
      if (denom <= 0) continue;
      const weights = units
        .filter((u) =>
          paysUnitCharges(
            u,
            category.includeEmptyUnits || building.perUnitIncludeEmpty,
          ),
        )
        .map((u) => ({ unitId: u.unitId, weight: 1 }));
      const shares = distributeRemainder(amount, weights);
      for (const unit of units) {
        const share = shares[unit.unitId];
        if (!share) continue;
        lines.push({
          unitId: unit.unitId,
          categoryId,
          categoryName: category.name,
          amountRial: share,
          basis: perUnitBasis(denom),
        });
      }
    }
  }

  const byUnit: AllocationPreview["byUnit"] = {};
  for (const unit of units) {
    byUnit[unit.unitId] = { totalRial: 0, lines: [] };
  }
  for (const line of lines) {
    byUnit[line.unitId].lines.push(line);
    byUnit[line.unitId].totalRial += line.amountRial;
  }

  return { lines, byUnit };
}

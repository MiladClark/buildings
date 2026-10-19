export type AllocationMethod =
  "per_person" | "per_unit" | "fixed_per_unit" | "excluded";

export type UnitStatus = "occupied" | "empty" | "owner_occupied";

export interface UnitSnapshot {
  unitId: string;
  label: string;
  occupantCount: number;
  status: UnitStatus;
  temporarilyAbsent?: boolean;
}

export interface CategoryInput {
  id: string;
  name: string;
  allocationMethod: AllocationMethod;
  includeEmptyUnits: boolean;
  fixedMonthlyAmount?: number | null;
}

export interface ExpenseInput {
  categoryId: string;
  amountRial: number;
  description?: string | null;
}

export interface BuildingAllocationSettings {
  perUnitIncludeEmpty: boolean;
  periodMonths?: number;
}

export interface UnitAllocationLine {
  unitId: string;
  categoryId: string;
  categoryName: string;
  amountRial: number;
  basis: string;
}

export interface AllocationPreview {
  lines: UnitAllocationLine[];
  byUnit: Record<string, { totalRial: number; lines: UnitAllocationLine[] }>;
}

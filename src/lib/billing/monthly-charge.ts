import { expenseCategory } from "@/lib/db/schema";
import type { LedgerTransaction } from "./settlement-store";

export const monthlyChargeSlug = "period-monthly-charge";
export const monthlyChargeCategoryId = (buildingId: string) =>
  `monthly-charge:${buildingId}`;

/** This inactive category is enabled only for the period with a saved charge. */
export async function ensureMonthlyChargeCategory(
  tx: LedgerTransaction,
  buildingId: string,
) {
  await tx
    .insert(expenseCategory)
    .values({
      id: monthlyChargeCategoryId(buildingId),
      buildingId,
      name: "شارژ این ماه",
      slug: monthlyChargeSlug,
      kind: "fixed",
      allocationMethod: "fixed_per_unit",
      includeEmptyUnits: true,
      fixedMonthlyAmount: 0,
      active: false,
      sortOrder: 10000,
    })
    .onConflictDoNothing();
}

export function periodChargeCategories<
  T extends {
    slug: string;
    active: boolean;
    fixedMonthlyAmount: number | null;
    includeEmptyUnits: boolean;
    allocationMethod?: string;
  },
>(categories: T[], manualMonthlyRial?: number | null): T[] {
  return categories.flatMap((category) =>
    category.slug !== monthlyChargeSlug
      ? manualMonthlyRial != null &&
        category.allocationMethod === "fixed_per_unit"
        ? []
        : [category]
      : manualMonthlyRial != null && manualMonthlyRial > 0
        ? [
            {
              ...category,
              active: true,
              fixedMonthlyAmount: manualMonthlyRial,
              includeEmptyUnits: true,
            },
          ]
        : [],
  );
}

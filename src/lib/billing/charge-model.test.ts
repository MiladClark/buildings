import { describe, expect, it } from "vitest";
import type { CategoryInput } from "./types";
import {
  usesChargeFund,
  costCoveredByCharge,
  receivableExpenses,
} from "./charge-model";
describe("charge funding model", () => {
  it("preserves issued direct bills and accepts an explicitly zero draft charge", () => {
    expect(usesChargeFund({ status: "draft" }, 0)).toBe(true);
    expect(usesChargeFund({ status: "draft" }, null)).toBe(false);
    expect(
      usesChargeFund({ status: "finalized", chargeModel: "direct" }, 3500000),
    ).toBe(false);
    expect(
      usesChargeFund({ status: "finalized", chargeModel: "fund" }, null),
    ).toBe(true);
  });
  it("only assesses water and explicit extraordinary costs in addition to base", () => {
    const categories: (CategoryInput & { slug: string })[] = [
      {
        id: "power",
        name: "برق",
        includeEmptyUnits: true,
        allocationMethod: "per_unit",
        slug: "common-electricity",
      },
      {
        id: "water",
        name: "آب",
        includeEmptyUnits: false,
        allocationMethod: "per_person",
        slug: "water",
      },
    ];
    const expenses = [
      { id: "p", categoryId: "power", amountRial: 100 },
      {
        id: "extra",
        categoryId: "power",
        amountRial: 200,
        billingTreatment: "separate",
      },
      { id: "w", categoryId: "water", amountRial: 300 },
    ];
    expect(
      receivableExpenses(categories, expenses, true).map((e) => e.id),
    ).toEqual(["extra", "w"]);
    expect(receivableExpenses(categories, expenses, false)).toEqual(expenses);
    expect(costCoveredByCharge(undefined, {}, true)).toBe(false);
  });
});

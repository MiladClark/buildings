import { describe, expect, it } from "vitest";
import { smartChargePlan } from "./smart-charge-plan";
const now = new Date("2026-10-25");
const categories = [
  ["cleaning", "per_unit"],
  ["common-electricity", "per_unit"],
  ["elevator", "per_unit"],
  ["equipment", "per_unit"],
  ["water", "per_person"],
  ["gas", "excluded"],
].map(([slug, allocationMethod]) => ({
  id: slug,
  name: slug,
  slug,
  allocationMethod,
}));
const cost = (
  id: string,
  categoryId: string,
  amountRial: number,
  extra = {},
) => ({ id, categoryId, amountRial, expenseDate: now, ...extra });
describe("smart monthly budget", () => {
  it("separates wages, multi-month bills, irregular repairs and annual equipment reserve", () => {
    const result = smartChargePlan({
      categories,
      unitCount: 8,
      now,
      expenses: [
        cost("wage", "cleaning", 17000000, { description: "نظافتچی" }),
        cost("power", "common-electricity", 4460000, { coverageMonths: 2 }),
        cost("repair", "elevator", 15000000),
        cost("tools", "equipment", 19000000),
        cost("water", "water", 5800000),
        cost("gas", "gas", 99999999),
      ],
    });
    expect(result.breakdown.map((r) => r.monthlyRial)).toEqual([
      17000000, 2230000, 5000000, 1583330,
    ]);
    expect(result.suggestedMonthlyRial).toBe(3600000);
    expect(result.preliminary).toBe(true);
  });
  it("weights variable bills by covered months and does not turn cleaning equipment into wages", () => {
    const result = smartChargePlan({
      categories,
      unitCount: 8,
      now,
      cleaningEveryDays: 14,
      expenses: [
        cost("tools", "cleaning", 12000000, {
          description: "خرید وسایل نظافت",
        }),
        cost("wage", "cleaning", 17000000, { description: "نظافتچی" }),
        cost("p1", "common-electricity", 4000000, { coverageMonths: 2 }),
        cost("p2", "common-electricity", 9000000, { coverageMonths: 3 }),
      ],
    });
    expect(
      result.breakdown.find((r) => r.key === "cleaning")?.monthlyRial,
    ).toBe(Math.round((17000000 * 30) / 14 / 10) * 10);
    expect(
      result.breakdown.find((r) => r.key === "common-electricity")?.monthlyRial,
    ).toBe(2600000);
    expect(
      result.breakdown.find((r) => r.key === "equipment")?.monthlyRial,
    ).toBe(1000000);
  });
  it("includes zero-repair months, excludes future/deleted/extraordinary costs, and handles no units", () => {
    const expenses = [
      cost("repair", "elevator", 15000000, {
        expenseDate: new Date("2026-05-25"),
      }),
      cost("future", "elevator", 99999999, {
        expenseDate: new Date("2026-12-01"),
      }),
      cost("deleted", "equipment", 99999999, { deletedAt: now }),
      cost("extra", "equipment", 99999999, { billingTreatment: "separate" }),
    ];
    const result = smartChargePlan({ categories, unitCount: 8, now, expenses });
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].monthlyRial).toBe(2500000);
    expect(
      smartChargePlan({ categories, unitCount: 0, now, expenses }).complete,
    ).toBe(false);
  });
  it("makes an unknown bill duration an explicit assumption and honors a zero cleaning budget", () => {
    const r = smartChargePlan({
      categories,
      unitCount: 8,
      now,
      cleaningVisitRial: 0,
      expenses: [cost("p", "common-electricity", 4000000)],
    });
    expect(
      r.breakdown.find((r) => r.key === "common-electricity"),
    ).toMatchObject({ monthlyRial: 2000000, assumed: true });
    expect(r.cleaningVisitRial).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  calculatePeriodChargePlan,
  defaultBudgetPolicy,
  type BudgetPolicy,
} from "./charge-plan";
import { fromJalali } from "@/lib/format/jalali";
const period = (id: string, month: number, endMonth = month) => ({
  id,
  title: id,
  startDate: fromJalali(1405, month, 1),
  endDate: fromJalali(1405, endMonth, 30),
});
const older = period("older", 6),
  target = period("target", 7),
  future = period("future", 8);
const category = (id: string, slug = id, allocationMethod = "per_unit") => ({
  id,
  name: id,
  slug,
  allocationMethod,
  active: true,
  fixedMonthlyAmount: null,
});
const expense = (
  id: string,
  categoryId: string,
  amountRial: number,
  periodId = "target",
  coverageMonths: number | null = null,
) => ({
  id,
  categoryId,
  periodId,
  coverageMonths,
  amountRial,
  expenseDate:
    periodId === "older"
      ? older.endDate
      : periodId === "future"
        ? future.endDate
        : target.endDate,
});
const policy = (
  categoryId: string,
  mode: BudgetPolicy["mode"],
  extra: Partial<BudgetPolicy> = {},
) => ({
  categoryId,
  mode,
  intervalMonths: null,
  monthlyReserveRial: null,
  ...extra,
});
const input = {
  target,
  periods: [older, target, future],
  categories: [
    category("cleaning"),
    category("power", "common-electricity"),
    category("equipment"),
    category("elevator"),
    category("water", "water", "per_person"),
  ],
  expenses: [],
  policies: [],
  unitCount: 8,
  bufferPercent: 10,
  roundToRial: 500000,
};

describe("monthly charge planning", () => {
  it("recognizes shared electricity, one-time supplies, per-person water and elevator reserves", () => {
    expect(input.categories.map((c) => defaultBudgetPolicy(c).mode)).toEqual([
      "monthly",
      "bill",
      "one_off",
      "reserve",
      "separate",
    ]);
  });
  it("weights fluctuating bills by their actual covered months", () => {
    const result = calculatePeriodChargePlan({
      ...input,
      categories: [category("power", "common-electricity")],
      expenses: [
        expense("a", "power", 1600000, "older", 2),
        expense("b", "power", 3000000, "target", 3),
      ],
    });
    expect(result.monthlyBuildingRial).toBe(920000);
    expect(result.complete).toBe(true);
  });
  it("sums visits in the latest period, reflecting the current monthly cleaning rate", () => {
    const result = calculatePeriodChargePlan({
      ...input,
      categories: [category("cleaning")],
      expenses: [
        expense("a", "cleaning", 1000000),
        expense("b", "cleaning", 1500000),
        expense("c", "cleaning", 3000000, "older"),
      ],
    });
    expect(result.monthlyBuildingRial).toBe(2500000);
    expect(result.breakdown[0].samples).toBe(1);
  });
  it("excludes one-time purchases and water, using the chosen repair reserve instead of a full repair bill", () => {
    const result = calculatePeriodChargePlan({
      ...input,
      expenses: [
        expense("a", "cleaning", 17000000),
        expense("b", "power", 1619000, "target", 2),
        expense("c", "equipment", 19000000),
        expense("d", "elevator", 14000000),
        expense("e", "water", 5800000),
      ],
      policies: [
        policy("elevator", "reserve", { monthlyReserveRial: 2000000 }),
      ],
    });
    expect(result.monthlyBuildingRial).toBe(19809500);
    expect(result.suggestedMonthlyRial).toBe(3000000);
    expect(result.complete).toBe(true);
  });
  it("does not invent a billing interval or a maintenance reserve", () => {
    const result = calculatePeriodChargePlan({
      ...input,
      expenses: [
        expense("a", "power", 1619000),
        expense("b", "cleaning", 17000000),
      ],
    });
    expect(result.complete).toBe(false);
    expect(result.missingCategories).toEqual(["power", "elevator"]);
  });
  it("uses each bill's interval ahead of its category fallback", () => {
    const result = calculatePeriodChargePlan({
      ...input,
      categories: [category("power", "common-electricity")],
      expenses: [
        expense("a", "power", 1200000, "older", 2),
        expense("b", "power", 1800000),
      ],
      policies: [policy("power", "bill", { intervalMonths: 3 })],
    });
    expect(result.monthlyBuildingRial).toBe(600000);
  });
  it("excludes deleted costs, deleted periods and future history", () => {
    const result = calculatePeriodChargePlan({
      ...input,
      categories: [category("cleaning")],
      periods: [target, future, { ...older, deletedAt: new Date() }],
      expenses: [
        expense("a", "cleaning", 1000000),
        { ...expense("b", "cleaning", 9999999), deletedAt: new Date() },
        expense("c", "cleaning", 9999999, "older"),
        expense("d", "cleaning", 9999999, "future"),
      ],
    });
    expect(result.monthlyBuildingRial).toBe(1000000);
  });
  it("normalizes a two-month expense period without doubling the monthly recommendation", () => {
    const twoMonths = period("target", 6, 7);
    const result = calculatePeriodChargePlan({
      ...input,
      target: twoMonths,
      periods: [twoMonths],
      categories: [category("cleaning")],
      expenses: [expense("a", "cleaning", 34000000)],
    });
    expect(result.periodMonths).toBe(2);
    expect(result.monthlyBuildingRial).toBe(17000000);
  });
  it("supports an explicit zero reserve and no fluctuation buffer", () => {
    const result = calculatePeriodChargePlan({
      ...input,
      categories: [category("cleaning"), category("elevator")],
      expenses: [expense("a", "cleaning", 8000000)],
      policies: [policy("elevator", "reserve", { monthlyReserveRial: 0 })],
      bufferPercent: 0,
      roundToRial: 100000,
    });
    expect(result.complete).toBe(true);
    expect(result.suggestedMonthlyRial).toBe(1000000);
  });
  it("requires active units and usable cost information", () => {
    expect(
      calculatePeriodChargePlan({ ...input, categories: [], unitCount: 0 })
        .complete,
    ).toBe(false);
    expect(
      calculatePeriodChargePlan({ ...input, categories: [] }).complete,
    ).toBe(false);
  });
  it("includes the final Tehran calendar day regardless of the saved time", () => {
    const lastDay = new Date(target.endDate);
    lastDay.setUTCHours(17, 30, 0, 0);
    const result = calculatePeriodChargePlan({
      ...input,
      categories: [category("cleaning")],
      expenses: [
        { ...expense("a", "cleaning", 8000000), expenseDate: lastDay },
      ],
    });
    expect(result.monthlyBuildingRial).toBe(8000000);
  });
  it("prefers the selected period's cleaning total over overlapping parallel periods", () => {
    const parallel = { ...target, id: "parallel" };
    const result = calculatePeriodChargePlan({
      ...input,
      periods: [parallel, target],
      categories: [category("cleaning")],
      expenses: [
        expense("a", "cleaning", 8000000),
        expense("b", "cleaning", 90000000, "parallel"),
      ],
    });
    expect(result.monthlyBuildingRial).toBe(8000000);
  });
});

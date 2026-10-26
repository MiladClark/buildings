import { describe, expect, it } from "vitest";
import { buildPeriodExpensesReport } from "./period-expenses";

const period = {
  id: "period",
  title: "مهر ۱۴۰۵",
  startDate: new Date("2026-09-23"),
  endDate: new Date("2026-10-22"),
  status: "draft" as const,
};
const cost = {
  periodId: period.id,
  description: "  نظافت راه‌پله  ",
  category: "نظافت",
  expenseDate: new Date("2026-10-01"),
  amountRial: 45000001,
};

describe("period expense report", () => {
  it("lists all actual costs but only adds water and extraordinary assessments to the base", () => {
    const report = buildPeriodExpensesReport({
      buildingName: "ساختمان",
      period,
      fund: true,
      manualMonthlyRial: 3500000,
      unitCount: 8,
      expenses: [
        { ...cost, amountRial: 19460000, coveredByCharge: true },
        {
          ...cost,
          category: "آب",
          amountRial: 5800000,
          coveredByCharge: false,
        },
      ],
    });
    expect(report.totalRial).toBe(25260000);
    expect(report.coveredTotalRial).toBe(19460000);
    expect(report.grandTotalRial).toBe(33800000);
    expect(report.items.map((r) => r.fundingLabel)).toEqual([
      "از محل شارژ",
      "دریافت جداگانه",
    ]);
  });
  it.each([3000000, 0, null, undefined])(
    "exports the exact manual monthly amount %s without adding it to real costs",
    (manualMonthlyRial) => {
      const report = buildPeriodExpensesReport({
        buildingName: "ساختمان",
        period,
        expenses: [cost],
        manualMonthlyRial,
        unitCount: 8,
      });
      expect(report.manualMonthlyRial).toBe(manualMonthlyRial ?? null);
      expect(report.totalRial).toBe(cost.amountRial);
      expect(report.chargeTotalRial).toBe(
        manualMonthlyRial == null ? null : manualMonthlyRial * 8,
      );
      expect(report.grandTotalRial).toBe(
        cost.amountRial + (manualMonthlyRial ?? 0) * 8,
      );
    },
  );
  it("counts a two-month charge once per unit and uses issued charge totals when supplied", () => {
    const source = {
      buildingName: "ساختمان",
      period: {
        ...period,
        startDate: new Date("2026-10-23"),
        endDate: new Date("2026-12-21"),
      },
      expenses: [cost],
      manualMonthlyRial: 3000000,
      unitCount: 8,
    };
    const draft = buildPeriodExpensesReport(source);
    expect(draft.periodMonths).toBe(2);
    expect(draft.chargeTotalRial).toBe(48000000);
    expect(draft.grandTotalRial).toBe(93000001);
    const issued = buildPeriodExpensesReport({ ...source, chargeTotalRial: 0 });
    expect(issued.grandTotalRial).toBe(cost.amountRial);
  });
  it("exports only live costs for this period and sums integers before formatting", () => {
    const report = buildPeriodExpensesReport({
      buildingName: "ساختمان",
      period,
      expenses: [
        cost,
        {
          ...cost,
          amountRial: 20000002,
          expenseDate: new Date("2026-10-02"),
          description: "تعمیر آسانسور",
          category: "آسانسور",
        },
        { ...cost, periodId: "other", amountRial: 999999999 },
        { ...cost, deletedAt: new Date(), amountRial: 999999999 },
      ],
    });
    expect(report.totalRial).toBe(65000003);
    expect(report.items.map((item) => item.description)).toEqual([
      "تعمیر آسانسور",
      "نظافت راه‌پله",
    ]);
    expect(report.items[0].date).toBe("۱۴۰۵/۰۷/۱۰");
    expect(report.draft).toBe(true);
    expect(report.statusLabel).toBe("پیش‌نویس");
    expect(report.periodTitle).toBe(period.title);
  });
  it("uses the category for blank descriptions without modifying source data", () => {
    const expenses = [
      { ...cost, description: "  " },
      { ...cost, description: null },
    ];
    const report = buildPeriodExpensesReport({
      buildingName: "ساختمان",
      period,
      expenses,
    });
    expect(report.items.map((item) => item.description)).toEqual([
      "نظافت",
      "نظافت",
    ]);
    expect(expenses[0].description).toBe("  ");
  });
  it.each([
    ["finalized", "نهایی‌شده"],
    ["archived", "بایگانی‌شده"],
  ] as const)("supports %s periods", (status, label) => {
    const report = buildPeriodExpensesReport({
      buildingName: "ساختمان",
      period: { ...period, status },
      expenses: [],
    });
    expect(report).toMatchObject({
      statusLabel: label,
      draft: false,
      totalRial: 0,
      items: [],
    });
  });
});

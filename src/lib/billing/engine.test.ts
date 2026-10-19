import { describe, expect, it } from "vitest";

import { allocatePeriodCharges } from "./engine";
import type { CategoryInput, ExpenseInput, UnitSnapshot } from "./types";
import { effectiveOccupants } from "./occupancy";

const units: UnitSnapshot[] = [
  { unitId: "u1", label: "۱", occupantCount: 1, status: "occupied" },
  { unitId: "u2", label: "۲", occupantCount: 4, status: "occupied" },
];

const categories: CategoryInput[] = [
  {
    id: "water",
    name: "آب",
    allocationMethod: "per_person",
    includeEmptyUnits: false,
  },
  {
    id: "elevator",
    name: "آسانسور",
    allocationMethod: "per_unit",
    includeEmptyUnits: false,
  },
];

describe("allocatePeriodCharges", () => {
  it("splits water by occupants and elevator by units", () => {
    const expenses: ExpenseInput[] = [
      { categoryId: "water", amountRial: 500_000 },
      { categoryId: "elevator", amountRial: 300_000 },
    ];

    const preview = allocatePeriodCharges(units, categories, expenses, {
      perUnitIncludeEmpty: false,
    });

    const waterU1 = preview.byUnit.u1.lines.find(
      (l) => l.categoryId === "water",
    );
    const waterU2 = preview.byUnit.u2.lines.find(
      (l) => l.categoryId === "water",
    );
    expect(waterU1?.amountRial).toBe(100_000);
    expect(waterU2?.amountRial).toBe(400_000);

    expect(
      preview.byUnit.u1.lines.find((l) => l.categoryId === "elevator")
        ?.amountRial,
    ).toBe(150_000);
    expect(
      preview.byUnit.u2.lines.find((l) => l.categoryId === "elevator")
        ?.amountRial,
    ).toBe(150_000);
  });
});

it("conserves every rial when distributing by population", () => {
  const people = [1, 1, 1].map((n, i) => ({
    unitId: `u${i}`,
    label: String(i),
    occupantCount: n,
    status: "occupied" as const,
  }));
  const p = allocatePeriodCharges(
    people,
    categories,
    [{ categoryId: "water", amountRial: 100 }],
    { perUnitIncludeEmpty: false },
  );
  expect(p.lines.reduce((s, l) => s + l.amountRial, 0)).toBe(100);
  expect(p.byUnit.u0.totalRial).toBe(34);
});
it("honors the building-level empty-unit setting in actual shares", () => {
  const withEmpty = [
    ...units,
    { unitId: "empty", label: "۳", occupantCount: 0, status: "empty" as const },
  ];
  const p = allocatePeriodCharges(
    withEmpty,
    categories,
    [{ categoryId: "elevator", amountRial: 300 }],
    { perUnitIncludeEmpty: true },
  );
  expect(p.byUnit.empty.totalRial).toBe(100);
  expect(p.byUnit.u1.lines[0].basis).toBe("تقسیم مساوی بین ۳ واحد");
});
it("never allocates water to an empty unit even if its stale count is positive", () => {
  const withEmpty = [
    ...units,
    { unitId: "empty", label: "۳", occupantCount: 4, status: "empty" as const },
  ];
  const p = allocatePeriodCharges(
    withEmpty,
    categories,
    [{ categoryId: "water", amountRial: 500 }],
    { perUnitIncludeEmpty: true },
  );
  expect(p.byUnit.empty.totalRial).toBe(0);
  expect(p.byUnit.u1.totalRial).toBe(100);
});
it("prorates monthly fixed charges for quarterly periods", () => {
  const p = allocatePeriodCharges(
    units,
    [
      {
        id: "fixed",
        name: "ثابت",
        allocationMethod: "fixed_per_unit",
        fixedMonthlyAmount: 100,
        includeEmptyUnits: false,
      },
    ],
    [{ categoryId: "fixed", amountRial: 1 }],
    { perUnitIncludeEmpty: false, periodMonths: 3 },
  );
  expect(p.byUnit.u1.totalRial).toBe(300);
});
it("excludes private gas from shared charges", () => {
  const p = allocatePeriodCharges(
    units,
    [
      {
        id: "gas",
        name: "گاز",
        allocationMethod: "excluded",
        includeEmptyUnits: false,
      },
    ],
    [{ categoryId: "gas", amountRial: 1000 }],
    { perUnitIncludeEmpty: false },
  );
  expect(p.lines).toHaveLength(0);
});

it("generates configured recurring charges without a dummy expense", () => {
  const p = allocatePeriodCharges(
    units,
    [
      {
        id: "standing",
        name: "شارژ ثابت",
        allocationMethod: "fixed_per_unit",
        fixedMonthlyAmount: 100,
        includeEmptyUnits: false,
      },
    ],
    [],
    { perUnitIncludeEmpty: false },
  );
  expect(p.byUnit.u1.totalRial).toBe(100);
  expect(p.byUnit.u2.totalRial).toBe(100);
});

it.each(["occupied", "owner_occupied", "empty"] as const)(
  "exempts an absent %s unit from water but collects electricity, elevator, cleaning and standing charges",
  (status) => {
    const absent: UnitSnapshot = {
      unitId: "away",
      label: "۳",
      occupantCount: 4,
      status,
      temporarilyAbsent: true,
    };
    const common: CategoryInput[] = ["electricity", "cleaning"].map((id) => ({
      id,
      name: id,
      allocationMethod: "per_unit",
      includeEmptyUnits: false,
    }));
    const p = allocatePeriodCharges(
      [...units, absent],
      [
        ...categories,
        ...common,
        {
          id: "standing",
          name: "ثابت",
          allocationMethod: "fixed_per_unit",
          fixedMonthlyAmount: 50,
          includeEmptyUnits: false,
        },
      ],
      [
        { categoryId: "water", amountRial: 500 },
        ...["elevator", "electricity", "cleaning"].map((categoryId) => ({
          categoryId,
          amountRial: 300,
        })),
      ],
      { perUnitIncludeEmpty: false, periodMonths: 3 },
    );
    expect(effectiveOccupants(absent)).toBe(0);
    expect(
      p.byUnit.away.lines.find((l) => l.categoryId === "water")?.amountRial,
    ).toBe(0);
    expect(
      p.byUnit.away.lines.find((l) => l.categoryId === "water")?.basis,
    ).toContain("غیبت موقت");
    for (const id of ["elevator", "electricity", "cleaning"])
      expect(
        p.byUnit.away.lines.find((l) => l.categoryId === id)?.amountRial,
      ).toBe(100);
    expect(
      p.byUnit.away.lines.find((l) => l.categoryId === "standing")?.amountRial,
    ).toBe(150);
    expect(
      p.lines
        .filter((l) => l.categoryId === "water")
        .reduce((s, l) => s + l.amountRial, 0),
    ).toBe(500);
    expect(
      p.byUnit.u1.lines.find((l) => l.categoryId === "water")?.amountRial,
    ).toBe(100);
  },
);

it("restores the saved household size after returning without changing common shares", () => {
  const absent = { ...units[1], temporarilyAbsent: true };
  const expenses = [
    { categoryId: "water", amountRial: 500 },
    { categoryId: "elevator", amountRial: 300 },
  ];
  const before = allocatePeriodCharges(
    [units[0], absent],
    categories,
    expenses,
    { perUnitIncludeEmpty: false },
  );
  const after = allocatePeriodCharges(
    [units[0], { ...absent, temporarilyAbsent: false }],
    categories,
    expenses,
    { perUnitIncludeEmpty: false },
  );
  expect(absent.occupantCount).toBe(4);
  expect(before.byUnit.u2.totalRial).toBe(150);
  expect(after.byUnit.u2.totalRial).toBe(550);
  expect(before.byUnit.u1.totalRial).toBe(650);
  expect(after.byUnit.u1.totalRial).toBe(250);
});

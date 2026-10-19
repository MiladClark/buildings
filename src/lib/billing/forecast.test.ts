import { describe, expect, it } from "vitest";
import { allocateChargeForecast } from "./forecast";
import type { UnitSnapshot } from "./types";
const units: UnitSnapshot[] = [
  {
    unitId: "a",
    label: "۱",
    occupantCount: 4,
    status: "occupied",
    temporarilyAbsent: true,
  },
  { unitId: "b", label: "۲", occupantCount: 2, status: "occupied" },
  { unitId: "c", label: "۳", occupantCount: 0, status: "empty" },
];
describe("forecast uses the invoice allocation rules", () => {
  it("exempts the absent household from water but includes it in common and fixed charges", () => {
    const r = allocateChargeForecast(
      units,
      [
        {
          categoryId: "water",
          name: "آب",
          averageRial: 101,
          inflationPercent: 0,
          method: "per_person",
          includeEmpty: false,
        },
        {
          categoryId: "common",
          name: "مشاعات",
          averageRial: 101,
          inflationPercent: 0,
          method: "per_unit",
          includeEmpty: false,
        },
        {
          categoryId: "fixed",
          name: "ثابت",
          averageRial: 100,
          inflationPercent: 0,
          method: "fixed_per_unit",
          includeEmpty: false,
        },
      ],
      0,
      0,
    );
    expect(
      r.preview.byUnit.a.lines.find((l) => l.categoryId === "water")
        ?.amountRial,
    ).toBe(0);
    expect(r.preview.byUnit.a.totalRial).toBe(101);
    expect(r.preview.byUnit.b.totalRial).toBe(201);
    expect(r.preview.byUnit.c.totalRial).toBe(0);
    expect(r.unallocatedRial).toBe(0);
  });
  it("conserves the exact building budget after reserve and rounding", () => {
    for (let value = 1; value < 30; value++) {
      const r = allocateChargeForecast(
        units,
        [
          {
            categoryId: "common",
            name: "برق",
            averageRial: value,
            inflationPercent: 15,
            method: "per_unit",
            includeEmpty: true,
          },
        ],
        5,
        10,
      );
      expect(
        Object.values(r.preview.byUnit).reduce((s, u) => s + u.totalRial, 0),
      ).toBe(r.withReserve);
      expect(r.unallocatedRial).toBe(0);
    }
  });
  it("reports an unallocated person-based budget when nobody is present", () => {
    const r = allocateChargeForecast(
      units.filter((u) => u.unitId !== "b"),
      [
        {
          categoryId: "water",
          name: "آب",
          averageRial: 100,
          inflationPercent: 0,
          method: "per_person",
          includeEmpty: false,
        },
      ],
      0,
      10,
    );
    expect(r.unallocatedRial).toBe(110);
    expect(
      Object.values(r.preview.byUnit).every((u) => u.totalRial === 0),
    ).toBe(true);
  });
});

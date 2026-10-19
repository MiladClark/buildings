import { describe, expect, it } from "vitest";
import { presetPeriodRange } from "./periods";
import {
  fromJalali,
  isoDate,
  jalaliMonthSpan,
  jalaliParts,
} from "@/lib/format/jalali";

describe("Persian billing presets", () => {
  it.each(["monthly", "bimonthly", "quarterly"] as const)(
    "covers complete months for %s",
    (type) => {
      const range = presetPeriodRange(isoDate(fromJalali(1405, 7, 25)), type);
      expect(jalaliParts(new Date(range.startDate))).toEqual({
        jy: 1405,
        jm: 7,
        jd: 1,
      });
      expect(
        jalaliMonthSpan(new Date(range.startDate), new Date(range.endDate)),
      ).toBe({ monthly: 1, bimonthly: 2, quarterly: 3 }[type]);
    },
  );
  it("ends a two-month winter period on non-leap Esfand 29", () => {
    const range = presetPeriodRange(
      isoDate(fromJalali(1405, 11, 1)),
      "bimonthly",
    );
    expect(jalaliParts(new Date(range.endDate))).toEqual({
      jy: 1405,
      jm: 12,
      jd: 29,
    });
  });
  it("includes Esfand 30 in a leap year", () => {
    const range = presetPeriodRange(
      isoDate(fromJalali(1403, 11, 1)),
      "bimonthly",
    );
    expect(jalaliParts(new Date(range.endDate))).toEqual({
      jy: 1403,
      jm: 12,
      jd: 30,
    });
  });
  it("crosses Nowruz without adding an extra billing month", () => {
    const range = presetPeriodRange(
      isoDate(fromJalali(1405, 12, 1)),
      "bimonthly",
    );
    expect(jalaliParts(new Date(range.endDate))).toEqual({
      jy: 1406,
      jm: 1,
      jd: 31,
    });
    expect(
      jalaliMonthSpan(new Date(range.startDate), new Date(range.endDate)),
    ).toBe(2);
  });
});

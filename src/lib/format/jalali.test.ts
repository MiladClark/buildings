import { describe, expect, it } from "vitest";
import {
  fromJalali,
  isoDate,
  jalaliMonthSpan,
  jalaliParts,
  nextJalaliDueDate,
} from "./jalali";
describe("Tehran and Jalali dates", () => {
  it("uses Tehran's civil date around midnight, independently of the host", () => {
    expect(isoDate(new Date("2026-10-17T22:00:00Z"))).toBe("2026-10-18");
  });
  it("handles the Esfand to Farvardin due-date rollover", () => {
    expect(
      jalaliParts(nextJalaliDueDate(fromJalali(1405, 12, 29), 10)),
    ).toEqual({ jy: 1406, jm: 1, jd: 10 });
  });
  it("recognizes a quarterly period across a year boundary", () => {
    expect(
      jalaliMonthSpan(fromJalali(1405, 11, 1), fromJalali(1406, 1, 31)),
    ).toBe(3);
  });
  it("round-trips Jalali dates", () => {
    expect(jalaliParts(fromJalali(1405, 7, 26))).toEqual({
      jy: 1405,
      jm: 7,
      jd: 26,
    });
  });
});

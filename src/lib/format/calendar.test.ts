import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  buildMonthGrid,
  calendarKeyboardDate,
  isSameDay,
} from "./calendar";
import { fromJalali, isoDate, jalaliParts } from "./jalali";

describe("Persian calendar interaction", () => {
  it("renders six continuous weeks beginning on Saturday, with adjacent month days", () => {
    const grid = buildMonthGrid(fromJalali(1405, 7, 1));
    expect(grid).toHaveLength(42);
    expect(grid[0].getUTCDay()).toBe(6);
    expect(jalaliParts(grid[0])).toEqual({ jy: 1405, jm: 6, jd: 28 });
    expect(grid.filter((date) => jalaliParts(date).jm === 7)).toHaveLength(30);
    expect(new Set(grid.map(isoDate)).size).toBe(42);
    for (let index = 1; index < grid.length; index++)
      expect(grid[index].getTime() - grid[index - 1].getTime()).toBe(
        86_400_000,
      );
  });
  it("includes Esfand 30 only in a leap year", () => {
    for (const [year, expected] of [
      [1403, 30],
      [1405, 29],
    ]) {
      expect(
        buildMonthGrid(fromJalali(year, 12, 1)).filter((date) => {
          const parts = jalaliParts(date);
          return parts.jy === year && parts.jm === 12;
        }),
      ).toHaveLength(expected);
    }
  });
  it("clamps month and year jumps without overflowing into the following month", () => {
    expect(
      jalaliParts(addCalendarMonths(fromJalali(1405, 6, 31), 1, true)),
    ).toEqual({ jy: 1405, jm: 7, jd: 30 });
    expect(
      jalaliParts(
        calendarKeyboardDate(fromJalali(1403, 12, 30), "PageDown", 6, true)!,
      ),
    ).toEqual({ jy: 1404, jm: 12, jd: 29 });
  });
  it("moves left to the next Persian day across Nowruz and right to the previous day", () => {
    const last = fromJalali(1405, 12, 29);
    const next = calendarKeyboardDate(last, "ArrowLeft")!;
    expect(jalaliParts(next)).toEqual({ jy: 1406, jm: 1, jd: 1 });
    expect(isSameDay(calendarKeyboardDate(next, "ArrowRight"), last)).toBe(
      true,
    );
  });
  it("uses Saturday and Friday as Home/End boundaries", () => {
    const middle = fromJalali(1405, 7, 1);
    expect(calendarKeyboardDate(middle, "Home")!.getUTCDay()).toBe(6);
    expect(calendarKeyboardDate(middle, "End")!.getUTCDay()).toBe(5);
    expect(calendarKeyboardDate(middle, "Enter")).toBeUndefined();
  });
  it("compares stored dates and Tehran's civil day consistently around UTC midnight", () => {
    expect(
      isSameDay(
        new Date("2026-10-17T22:00:00Z"),
        new Date("2026-10-18T08:30:00Z"),
      ),
    ).toBe(true);
  });
});

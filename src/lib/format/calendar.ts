import jalaali from "jalaali-js";
import { fromJalali, isoDate, jalaliParts } from "./jalali";

export type WeekStart = 0 | 1 | 6;

export function calendarDay(date: Date): Date {
  const { jy, jm, jd } = jalaliParts(date);
  return fromJalali(jy, jm, jd);
}

export function isSameDay(a?: Date, b?: Date): boolean {
  return !!a && !!b && isoDate(a) === isoDate(b);
}

export function isSameMonth(a: Date, b: Date): boolean {
  const first = jalaliParts(a),
    second = jalaliParts(b);
  return first.jy === second.jy && first.jm === second.jm;
}

export function addCalendarDays(date: Date, amount: number): Date {
  const result = calendarDay(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

export function addCalendarMonths(
  date: Date,
  amount: number,
  preserveDay = false,
): Date {
  const { jy, jm, jd } = jalaliParts(date);
  const index = jy * 12 + jm - 1 + amount;
  const year = Math.floor(index / 12),
    month = (((index % 12) + 12) % 12) + 1;
  return fromJalali(
    year,
    month,
    preserveDay ? Math.min(jd, jalaali.jalaaliMonthLength(year, month)) : 1,
  );
}

export function buildMonthGrid(
  month: Date,
  weekStartsOn: WeekStart = 6,
): Date[] {
  const { jy, jm } = jalaliParts(month);
  const first = fromJalali(jy, jm, 1);
  const leading = (first.getUTCDay() - weekStartsOn + 7) % 7;
  return Array.from({ length: 42 }, (_, index) =>
    addCalendarDays(first, index - leading),
  );
}

/** Arrow movement follows the visible right-to-left Persian week. */
export function calendarKeyboardDate(
  date: Date,
  key: string,
  weekStartsOn: WeekStart = 6,
  shift = false,
): Date | undefined {
  const deltas: Record<string, number> = {
    ArrowLeft: 1,
    ArrowRight: -1,
    ArrowUp: -7,
    ArrowDown: 7,
  };
  if (key in deltas) return addCalendarDays(date, deltas[key]);
  const weekday = (calendarDay(date).getUTCDay() - weekStartsOn + 7) % 7;
  if (key === "Home" || key === "End")
    return addCalendarDays(date, key === "Home" ? -weekday : 6 - weekday);
  if (key === "PageUp" || key === "PageDown")
    return addCalendarMonths(
      date,
      (key === "PageUp" ? -1 : 1) * (shift ? 12 : 1),
      true,
    );
}

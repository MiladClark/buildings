import jalaali from "jalaali-js";
import { fromJalali, isoDate, jalaliParts } from "@/lib/format/jalali";

export const periodTypes = [
  "monthly",
  "bimonthly",
  "quarterly",
  "custom",
] as const;
export type PeriodType = (typeof periodTypes)[number];
export const periodOptions: {
  value: PeriodType;
  label: string;
  months: number;
}[] = [
  { value: "monthly", label: "یک‌ماهه", months: 1 },
  { value: "bimonthly", label: "دوماهه", months: 2 },
  { value: "quarterly", label: "سه‌ماهه", months: 3 },
  { value: "custom", label: "بازه دلخواه", months: 0 },
];

/** Presets cover complete Persian calendar months, including leap Esfand. */
export function presetPeriodRange(
  start: string,
  type: Exclude<PeriodType, "custom">,
) {
  const { jy, jm } = jalaliParts(new Date(start));
  const count = periodOptions.find((option) => option.value === type)!.months;
  const index = jy * 12 + jm - 1 + count - 1;
  const endYear = Math.floor(index / 12),
    endMonth = (index % 12) + 1;
  return {
    startDate: isoDate(fromJalali(jy, jm, 1)),
    endDate: isoDate(
      fromJalali(
        endYear,
        endMonth,
        jalaali.jalaaliMonthLength(endYear, endMonth),
      ),
    ),
  };
}

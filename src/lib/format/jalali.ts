import jalaali from "jalaali-js";

export const jalaliMonths = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
const persianDateFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
const civilDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function jalaliParts(date: Date) {
  const parts = persianDateFormatter.formatToParts(date);
  const get = (name: string) =>
    Number(parts.find((p) => p.type === name)?.value);
  return { jy: get("year"), jm: get("month"), jd: get("day") };
}
export function fromJalali(jy: number, jm: number, jd: number) {
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 8, 30));
}
export function isoDate(date: Date) {
  const parts = civilDateFormatter.formatToParts(date);
  const get = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function nextJalaliDueDate(endDate: Date, day: number) {
  const { jy, jm } = jalaliParts(endDate);
  return fromJalali(jm === 12 ? jy + 1 : jy, jm === 12 ? 1 : jm + 1, day);
}
export function jalaliMonthSpan(start: Date, end: Date) {
  const s = jalaliParts(start),
    e = jalaliParts(end);
  return Math.max(1, (e.jy - s.jy) * 12 + e.jm - s.jm + 1);
}

export function formatJalaliDate(date: Date): string {
  const { jy, jm, jd } = jalaliParts(date);
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`.replace(
    /\d/g,
    (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)],
  );
}

export function formatJalaliMonthLabel(date: Date): string {
  const months = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ];
  const { jy, jm } = jalaliParts(date);
  return `${months[jm - 1]} ${jy}`.replace(
    /\d/g,
    (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)],
  );
}

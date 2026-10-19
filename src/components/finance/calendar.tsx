"use client";
import { useState } from "react";
import jalaali from "jalaali-js";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { fromJalali, jalaliMonths, jalaliParts } from "@/lib/format/jalali";
import { toPersianDigits as fa } from "@/lib/format/money";

export { JalaliDateField } from "./jalali-date-field";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  href: string;
  kind: "due" | "expense" | "payment" | "maintenance";
};
export function BuildingCalendar({
  events,
  compact = false,
}: {
  events: CalendarEvent[];
  compact?: boolean;
}) {
  const today = jalaliParts(new Date());
  const [month, setMonth] = useState({ jy: today.jy, jm: today.jm });
  const [selected, setSelected] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const days = jalaali.jalaaliMonthLength(month.jy, month.jm);
  const first = fromJalali(month.jy, month.jm, 1);
  const offset = (first.getUTCDay() + 1) % 7;
  const monthEvents = events.filter((e) => {
    const p = jalaliParts(new Date(e.date));
    return p.jy === month.jy && p.jm === month.jm;
  });
  const selectedEvents = monthEvents.filter(
    (e) => selected === null || jalaliParts(new Date(e.date)).jd === selected,
  );
  const move = (n: number) => {
    setMonth((p) => {
      const m = p.jm + n;
      return {
        jy: m < 1 ? p.jy - 1 : m > 12 ? p.jy + 1 : p.jy,
        jm: m < 1 ? 12 : m > 12 ? 1 : m,
      };
    });
    setSelected(null);
    setShowAll(false);
  };
  return (
    <div>
      <div className="flex items-center justify-between px-5 pb-4">
        <p className="text-xs font-medium">
          {jalaliMonths[month.jm - 1]} {fa(String(month.jy))}
        </p>
        <div className="flex items-center gap-2">
          <button
            aria-label="ماه قبل"
            onClick={() => move(-1)}
            className="rounded p-1.5 hover:bg-muted"
          >
            <CaretRight size={14} />
          </button>
          <button
            onClick={() => {
              setMonth(today);
              setSelected(today.jd);
            }}
            className="text-[10px] text-muted-foreground"
          >
            امروز
          </button>
          <button
            aria-label="ماه بعد"
            onClick={() => move(1)}
            className="rounded p-1.5 hover:bg-muted"
          >
            <CaretLeft size={14} />
          </button>
        </div>
      </div>
      <div
        className={`grid grid-cols-7 gap-1 px-4 ${compact ? "text-[10px]" : "text-xs"}`}
      >
        <span className="py-2 text-center text-muted-foreground">ش</span>
        {["ی", "د", "س", "چ", "پ", "ج"].map((w) => (
          <span key={w} className="py-2 text-center text-muted-foreground">
            {w}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const isToday =
            today.jy === month.jy && today.jm === month.jm && d === today.jd;
          const dayEvents = monthEvents.filter(
            (e) => jalaliParts(new Date(e.date)).jd === d,
          );
          return (
            <button
              key={d}
              onClick={() => setSelected(selected === d ? null : d)}
              aria-label={`${fa(String(d))} ${jalaliMonths[month.jm - 1]}، ${fa(String(dayEvents.length))} رویداد`}
              aria-pressed={selected === d}
              className={`relative mx-auto flex w-full max-w-12 flex-col items-center justify-center rounded-lg ${compact ? "h-8" : "h-12"} ${isToday ? "bg-primary text-primary-foreground" : selected === d ? "bg-secondary text-primary ring-1 ring-primary" : "hover:bg-muted"}`}
            >
              {fa(String(d))}
              {dayEvents.length > 0 && (
                <span
                  className={`absolute bottom-0.5 size-1 rounded-full ${isToday ? "bg-primary-foreground" : "bg-primary"}`}
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="mx-5 mt-5 border-t border-border py-4">
        <p className="mb-3 text-[10px] font-medium text-muted-foreground">
          {selected
            ? `رویدادهای ${fa(String(selected))} ${jalaliMonths[month.jm - 1]}`
            : "رویدادهای این ماه"}
        </p>
        {selectedEvents.length ? (
          <div className="space-y-3">
            {selectedEvents
              .slice(0, showAll ? undefined : compact ? 2 : 10)
              .map((e) => (
                <a
                  key={e.id}
                  href={e.href}
                  className="flex items-center gap-2.5 rounded-md p-1 text-xs hover:bg-muted"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    {fa(String(jalaliParts(new Date(e.date)).jd))}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium">
                      {e.title}
                    </span>
                    <span className="mt-1 block text-[9px] text-muted-foreground">
                      {e.kind === "due"
                        ? "سررسید پرداخت"
                        : e.kind === "expense"
                          ? "هزینه ثبت‌شده"
                          : e.kind === "maintenance"
                            ? "برنامه رسیدگی"
                            : "واریز ثبت‌شده"}
                    </span>
                  </span>
                </a>
              ))}
          </div>
        ) : (
          <p className="text-[11px] leading-6 text-muted-foreground">
            برای این {selected ? "روز" : "ماه"} رویدادی ثبت نشده است.
          </p>
        )}
        {selectedEvents.length > (compact ? 2 : 10) && (
          <button
            type="button"
            className="mt-4 text-xs text-primary"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll
              ? "نمایش کمتر"
              : `نمایش همه ${fa(String(selectedEvents.length))} رویداد`}
          </button>
        )}
      </div>
    </div>
  );
}

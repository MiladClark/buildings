"use client";

import * as React from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type AnimationDefinition,
} from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calendarDay as startOfDay,
  isSameDay,
  isSameMonth,
  addCalendarMonths as addMonths,
  buildMonthGrid,
  calendarKeyboardDate,
  type WeekStart,
} from "@/lib/format/calendar";
import {
  fromJalali,
  isoDate,
  jalaliMonths as MONTH_NAMES,
  jalaliParts,
} from "@/lib/format/jalali";
import { toPersianDigits as fa } from "@/lib/format/money";

/* ─── Types ─────────────────────────────────────────────────── */

export type CalendarMode = "single" | "range" | "multiple";

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface CalendarEvent {
  date: Date;
  label?: string;
}

interface CalendarSharedProps {
  /** Month currently displayed (controlled). */
  month?: Date;
  /** Initial displayed month (uncontrolled). Defaults to today's month. */
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Persian weeks start on Saturday (6). */
  weekStartsOn?: WeekStart;
  /** Used by whole-month billing presets. */
  selectionMode?: "day" | "month";
  toggleSelection?: boolean;
  /** Return true to disable a date from selection. */
  disabled?: (date: Date) => boolean;
  /** Dates that are unavailable/reserved, shown struck-through and disabled. */
  bookedDates?: Date[];
  /** Dates with a scheduled-event indicator dot. */
  events?: CalendarEvent[];
  /** Enables the fast month/year jump view when clicking the header label. Default true. */
  quickNav?: boolean;
  className?: string;
}

interface CalendarSingleProps extends CalendarSharedProps {
  mode?: "single";
  selected?: Date;
  defaultSelected?: Date;
  onSelect?: (date: Date | undefined) => void;
}

interface CalendarMultipleProps extends CalendarSharedProps {
  mode: "multiple";
  selected?: Date[];
  defaultSelected?: Date[];
  onSelect?: (dates: Date[]) => void;
}

interface CalendarRangeProps extends CalendarSharedProps {
  mode: "range";
  selected?: DateRange;
  defaultSelected?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
}

export type CalendarProps =
  CalendarSingleProps | CalendarMultipleProps | CalendarRangeProps;

/* ─── Easing ────────────────────────────────────────────────── */

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/* ─── Date Helpers ──────────────────────────────────────────── */

const WEEKDAY_LABELS = ["ی", "د", "س", "چ", "پ", "ج", "ش"];
const WEEKDAY_NAMES = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

function isBefore(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

function isWithinRange(date: Date, range: DateRange): boolean {
  if (!range.from || !range.to) return false;
  const t = startOfDay(date).getTime();
  const from = startOfDay(range.from).getTime();
  const to = startOfDay(range.to).getTime();
  return t > Math.min(from, to) && t < Math.max(from, to);
}

/* ─── Quick-Nav Tooltip ─────────────────────────────────────── */

/**
 * Minimal CSS-only tooltip for the header's month/year quick-nav controls.
 * Kept local instead of the Tooltip primitive: it needs no portal/positioning
 * logic for a fixed-position label, so a Tooltip (+ Radix) dependency isn't
 * worth it here, and primitives can't import each other's source directly.
 */
function QuickNavTooltip({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: React.ReactElement;
}) {
  if (disabled) return children;

  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap",
          "rounded-[var(--primitive-radius-control-sm,0.625rem)] bg-[var(--foreground)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--background)]",
          "origin-top scale-95 opacity-0 transition-[opacity,transform] delay-0 duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          // Hover-only: no focus-within trigger (would fire on click since
          // the button receives focus) and force-hidden on :active so a
          // click can't leave a stale label visible mid-transition.
          "group-hover/tip:scale-100 group-hover/tip:opacity-100 group-hover/tip:delay-300",
          "group-active/tip:!opacity-0 group-active/tip:!delay-0 group-active/tip:!duration-0",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/* ─── <Calendar> ────────────────────────────────────────────── */

export const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  (props, ref) => {
    const {
      mode = "single",
      month: controlledMonth,
      defaultMonth,
      onMonthChange,
      weekStartsOn = 6,
      selectionMode = "day",
      toggleSelection = true,
      disabled,
      bookedDates,
      events,
      quickNav = true,
      className,
      selected,
      defaultSelected,
      onSelect,
    } = props as CalendarSharedProps & {
      mode?: CalendarMode;
      selected?: Date | Date[] | DateRange;
      defaultSelected?: Date | Date[] | DateRange;
      onSelect?: (
        value: Date | undefined | Date[] | DateRange | undefined,
      ) => void;
    };

    const prefersReducedMotion = useReducedMotion();
    const today = React.useMemo(() => startOfDay(new Date()), []);

    const [internalMonth, setInternalMonth] = React.useState(() =>
      startOfDay(defaultMonth ?? controlledMonth ?? new Date()),
    );
    const isMonthControlled = controlledMonth !== undefined;
    const displayedMonth = isMonthControlled ? controlledMonth : internalMonth;
    const { jy: displayYear, jm: displayMonth } = jalaliParts(displayedMonth);

    const [navView, setNavView] = React.useState<"days" | "months" | "years">(
      selectionMode === "month" ? "months" : "days",
    );
    const [direction, setDirection] = React.useState(1);
    // Center of the 12-year picker grid, independent of displayedMonth so
    // paging through years (via the picker's own prev/next) doesn't require
    // navigating the actual displayed month.
    const [yearAnchor, setYearAnchor] = React.useState(() => displayYear);

    const pickerRef = React.useRef<HTMLDivElement>(null);
    const pendingViewFocus = React.useRef(false);
    function showView(view: "days" | "months" | "years") {
      pendingViewFocus.current = true;
      setNavView(view);
    }
    function openYearsView() {
      setYearAnchor(displayYear);
      showView("years");
    }

    // When keyboard nav crosses a month boundary, the day grid remounts (its
    // motion.div key changes) so the old DOM node queried synchronously is the
    // exiting month's grid, not the one containing the target date. Stash the
    // target here and focus it once the new month's grid is actually mounted.
    const dayGridRef = React.useRef<HTMLDivElement | null>(null);
    const pendingFocusDateRef = React.useRef<Date | null>(null);

    const focusEnteringView = (definition: AnimationDefinition) => {
      // The outgoing grid also contains adjacent-month dates. Never move focus
      // into that grid while AnimatePresence is removing it.
      if (
        typeof definition !== "object" ||
        !("opacity" in definition) ||
        definition.opacity !== 1
      )
        return;
      if (pendingViewFocus.current) {
        pickerRef.current
          ?.querySelector<HTMLButtonElement>('[data-calendar-focus="true"]')
          ?.focus();
        pendingViewFocus.current = false;
      }
      const target = pendingFocusDateRef.current;
      if (!target || !isSameMonth(target, displayedMonth)) return;
      const button = dayGridRef.current?.querySelector<HTMLButtonElement>(
        `[data-date-key="${isoDate(target)}"]`,
      );
      if (button) {
        button.focus();
        pendingFocusDateRef.current = null;
      }
    };

    const setMonth = React.useCallback(
      (next: Date, dir: number) => {
        setDirection(dir);
        if (!isMonthControlled) setInternalMonth(next);
        onMonthChange?.(next);
      },
      [isMonthControlled, onMonthChange],
    );

    // Internal selection state, used when the caller does not control `selected`.
    const [internalSingle, setInternalSingle] = React.useState<
      Date | undefined
    >(mode === "single" ? (defaultSelected as Date | undefined) : undefined);
    const [internalMultiple, setInternalMultiple] = React.useState<Date[]>(
      mode === "multiple"
        ? ((defaultSelected as Date[] | undefined) ?? [])
        : [],
    );
    const [internalRange, setInternalRange] = React.useState<
      DateRange | undefined
    >(
      mode === "range" ? (defaultSelected as DateRange | undefined) : undefined,
    );

    const isSelectedControlled = Object.prototype.hasOwnProperty.call(
      props,
      "selected",
    );

    const currentSingle =
      mode === "single"
        ? ((isSelectedControlled ? selected : internalSingle) as
            Date | undefined)
        : undefined;
    const currentMultiple =
      mode === "multiple"
        ? (((isSelectedControlled ? selected : internalMultiple) as
            Date[] | undefined) ?? [])
        : [];
    const currentRange =
      mode === "range"
        ? ((isSelectedControlled ? selected : internalRange) as
            DateRange | undefined)
        : undefined;

    function isDisabled(date: Date): boolean {
      if (bookedDates?.some((b) => isSameDay(b, date))) return true;
      return disabled?.(date) ?? false;
    }

    function isBooked(date: Date): boolean {
      return bookedDates?.some((b) => isSameDay(b, date)) ?? false;
    }

    function eventFor(date: Date): CalendarEvent | undefined {
      return events?.find((e) => isSameDay(e.date, date));
    }

    function handleSelectDay(date: Date) {
      if (isDisabled(date)) return;

      if (mode === "single") {
        const next =
          toggleSelection && isSameDay(currentSingle, date) ? undefined : date;
        if (!isSelectedControlled) setInternalSingle(next);
        (onSelect as CalendarSingleProps["onSelect"])?.(next);
        return;
      }

      if (mode === "multiple") {
        const exists = currentMultiple.some((d) => isSameDay(d, date));
        const next = exists
          ? currentMultiple.filter((d) => !isSameDay(d, date))
          : [...currentMultiple, date];
        if (!isSelectedControlled) setInternalMultiple(next);
        (onSelect as CalendarMultipleProps["onSelect"])?.(next);
        return;
      }

      // range
      const from = currentRange?.from;
      const to = currentRange?.to;
      let next: DateRange;
      if (!from || (from && to)) {
        next = { from: date, to: undefined };
      } else if (isBefore(date, from)) {
        next = { from: date, to: from };
      } else {
        next = { from, to: date };
      }
      if (!isSelectedControlled) setInternalRange(next);
      (onSelect as CalendarRangeProps["onSelect"])?.(next);
    }

    function goToMonth(offset: number) {
      setMonth(addMonths(displayedMonth, offset), offset >= 0 ? 1 : -1);
    }

    const weekdayLabels = Array.from(
      { length: 7 },
      (_, i) => WEEKDAY_LABELS[(weekStartsOn + i) % 7],
    );
    const grid = React.useMemo(
      () => buildMonthGrid(displayedMonth, weekStartsOn),
      [displayedMonth, weekStartsOn],
    );

    // Roving tabindex target: the selected day if it falls in the displayed
    // month, otherwise today if visible, otherwise the 1st of the month.
    const focusableDate = React.useMemo(() => {
      if (
        mode === "single" &&
        currentSingle &&
        isSameMonth(currentSingle, displayedMonth)
      )
        return currentSingle;
      if (isSameMonth(today, displayedMonth)) return today;
      return fromJalali(displayYear, displayMonth, 1);
    }, [mode, currentSingle, displayedMonth, today, displayYear, displayMonth]);

    const [activeDate, setActiveDate] = React.useState<Date>();
    const tabStopDate =
      activeDate && isSameMonth(activeDate, displayedMonth)
        ? activeDate
        : focusableDate;

    function cellState(date: Date) {
      const outsideMonth = !isSameMonth(date, displayedMonth);
      const isToday = isSameDay(date, today);
      const isBookedDay = isBooked(date);
      const event = eventFor(date);
      const isDayDisabled = isDisabled(date);

      let isSelected = false;
      let isRangeStart = false;
      let isRangeEnd = false;
      let isInRange = false;

      if (mode === "single") {
        isSelected = isSameDay(currentSingle, date);
      } else if (mode === "multiple") {
        isSelected = currentMultiple.some((d) => isSameDay(d, date));
      } else if (mode === "range" && currentRange) {
        isRangeStart = isSameDay(currentRange.from, date);
        isRangeEnd = isSameDay(currentRange.to, date);
        isInRange = isWithinRange(date, currentRange);
        isSelected = isRangeStart || isRangeEnd;
      }

      return {
        outsideMonth,
        isToday,
        isBookedDay,
        event,
        isDayDisabled,
        isSelected,
        isRangeStart,
        isRangeEnd,
        isInRange,
      };
    }

    const monthLabel = `${MONTH_NAMES[displayMonth - 1]} ${fa(String(displayYear))}`;
    const weeks = React.useMemo(() => {
      const rows: Date[][] = [];
      for (let i = 0; i < grid.length; i += 7) {
        rows.push(grid.slice(i, i + 7));
      }
      return rows;
    }, [grid]);

    return (
      <div
        dir="rtl"
        ref={ref}
        data-slot="calendar"
        data-mode={mode}
        className={cn(
          "w-full max-w-[300px] select-none rounded-[var(--primitive-radius-surface,1rem)] border border-[var(--border)] p-3",
          "bg-card",
          className,
        )}
      >
        {/* Screen-reader announcement when the displayed month changes. */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {monthLabel}
        </div>

        {/* Header */}
        <div className="mb-2 flex items-center justify-between gap-1">
          <button
            type="button"
            aria-label={
              navView === "days"
                ? "ماه قبل"
                : navView === "months"
                  ? "سال قبل"
                  : "سال‌های قبل"
            }
            onClick={() =>
              navView === "years"
                ? setYearAnchor((year) => year - 12)
                : goToMonth(navView === "months" ? -12 : -1)
            }
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-[var(--primitive-radius-control-sm,0.625rem)] text-[var(--muted-foreground)]",
              "outline-none transition-colors duration-150",
              "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))] hover:text-[var(--foreground)]",
              "focus-visible:bg-secondary focus-visible:text-secondary-foreground",
            )}
          >
            <ChevronRight size={16} />
          </button>

          <div className="flex items-center gap-0.5">
            <QuickNavTooltip label="انتخاب ماه" disabled={!quickNav}>
              <button
                type="button"
                disabled={!quickNav}
                aria-label="انتخاب ماه"
                onClick={() => showView("months")}
                className={cn(
                  "rounded-[var(--primitive-radius-control-sm,0.625rem)] px-1.5 py-1 text-[13px] font-medium tracking-[-0.01em] text-[var(--foreground)]",
                  "outline-none transition-colors duration-150",
                  quickNav &&
                    "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))]",
                  "focus-visible:bg-secondary focus-visible:text-secondary-foreground",
                  navView === "months" &&
                    "bg-[color:var(--primitive-surface-selected,color-mix(in_srgb,var(--foreground)_6%,transparent))]",
                )}
              >
                {MONTH_NAMES[displayMonth - 1]}
              </button>
            </QuickNavTooltip>

            <QuickNavTooltip
              label={navView === "months" ? "انتخاب سال" : "انتخاب ماه یا سال"}
              disabled={!quickNav}
            >
              <button
                type="button"
                disabled={!quickNav}
                aria-label="تغییر نمای تقویم"
                onClick={() =>
                  navView === "months" ? openYearsView() : showView("months")
                }
                className={cn(
                  "rounded-[var(--primitive-radius-control-sm,0.625rem)] px-0.5 py-1 text-[13px] font-medium text-[var(--muted-foreground)]/40",
                  "outline-none transition-colors duration-150",
                  quickNav && "hover:text-[var(--muted-foreground)]",
                  "focus-visible:bg-secondary focus-visible:text-secondary-foreground",
                )}
              >
                |
              </button>
            </QuickNavTooltip>

            <QuickNavTooltip label="انتخاب سال" disabled={!quickNav}>
              <button
                type="button"
                disabled={!quickNav}
                aria-label="انتخاب سال"
                onClick={openYearsView}
                className={cn(
                  "rounded-[var(--primitive-radius-control-sm,0.625rem)] px-1.5 py-1 text-[13px] font-medium tracking-[-0.01em] text-[var(--foreground)]",
                  "outline-none transition-colors duration-150",
                  quickNav &&
                    "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))]",
                  "focus-visible:bg-secondary focus-visible:text-secondary-foreground",
                  navView === "years" &&
                    "bg-[color:var(--primitive-surface-selected,color-mix(in_srgb,var(--foreground)_6%,transparent))]",
                )}
              >
                {fa(String(displayYear))}
              </button>
            </QuickNavTooltip>
          </div>

          <button
            type="button"
            aria-label={
              navView === "days"
                ? "ماه بعد"
                : navView === "months"
                  ? "سال بعد"
                  : "سال‌های بعد"
            }
            onClick={() =>
              navView === "years"
                ? setYearAnchor((year) => year + 12)
                : goToMonth(navView === "months" ? 12 : 1)
            }
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-[var(--primitive-radius-control-sm,0.625rem)] text-[var(--muted-foreground)]",
              "outline-none transition-colors duration-150",
              "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))] hover:text-[var(--foreground)]",
              "focus-visible:bg-secondary focus-visible:text-secondary-foreground",
            )}
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div ref={pickerRef} className="relative min-h-[256px] overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {navView === "days" && (
              <motion.div
                key={`${fa(String(displayYear))}-${displayMonth - 1}`}
                onAnimationComplete={focusEnteringView}
                custom={direction}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction * -12 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction * 12 }
                }
                transition={{
                  duration: prefersReducedMotion ? 0.12 : 0.18,
                  ease: EASE_OUT,
                }}
              >
                {/* Weekday row */}
                <div className="mb-1 grid grid-cols-7">
                  {weekdayLabels.map((label, i) => (
                    <div
                      key={`${label}-${i}`}
                      title={WEEKDAY_NAMES[(weekStartsOn + i) % 7]}
                      className="flex h-7 items-center justify-center text-[11px] font-medium text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Day grid, ARIA grid with row/gridcell required children. */}
                <div
                  ref={dayGridRef}
                  role="grid"
                  aria-label={monthLabel}
                  className="grid grid-cols-7 gap-y-0.5"
                  onKeyDown={(e) => {
                    const raw = (e.target as HTMLElement).dataset.date;
                    if (!raw) return;
                    const targetDate = calendarKeyboardDate(
                      new Date(raw),
                      e.key,
                      weekStartsOn,
                      e.shiftKey,
                    );
                    if (!targetDate) return;
                    e.preventDefault();
                    if (!isSameMonth(targetDate, displayedMonth)) {
                      pendingFocusDateRef.current = targetDate;
                      setMonth(
                        addMonths(targetDate, 0),
                        isBefore(targetDate, displayedMonth) ? -1 : 1,
                      );
                      return;
                    }
                    const iso = isoDate(targetDate);
                    (
                      dayGridRef.current?.querySelector(
                        `[data-date-key="${iso}"]`,
                      ) as HTMLElement | null
                    )?.focus();
                  }}
                >
                  {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} role="row" className="contents">
                      {week.map((date) => {
                        const state = cellState(date);
                        return (
                          <div
                            key={date.toISOString()}
                            role="gridcell"
                            aria-selected={state.isSelected}
                            className="relative flex h-9 items-center justify-center"
                          >
                            {/* Range band: full width between the endpoints, half width
                              on the endpoint cells themselves so it visually meets
                              the solid selected circle instead of leaving a gap. */}
                            {mode === "range" &&
                              currentRange?.from &&
                              currentRange?.to &&
                              !isSameDay(currentRange.from, currentRange.to) &&
                              (state.isInRange ||
                                state.isRangeStart ||
                                state.isRangeEnd) && (
                                <div
                                  className={cn(
                                    "absolute inset-y-0 bg-[color:var(--primitive-surface-selected,color-mix(in_srgb,var(--foreground)_6%,transparent))]",
                                    state.isRangeStart
                                      ? "left-0 right-1/2"
                                      : state.isRangeEnd
                                        ? "left-1/2 right-0"
                                        : "inset-x-0",
                                  )}
                                />
                              )}
                            <button
                              type="button"
                              disabled={state.isDayDisabled}
                              aria-label={`${fa(String(jalaliParts(date).jd))} ${MONTH_NAMES[jalaliParts(date).jm - 1]} ${fa(String(jalaliParts(date).jy))}${state.isToday ? "، امروز" : ""}`}
                              aria-current={state.isToday ? "date" : undefined}
                              data-date={date.toISOString()}
                              data-date-key={isoDate(date)}
                              data-calendar-focus={
                                isSameDay(date, tabStopDate) || undefined
                              }
                              tabIndex={isSameDay(date, tabStopDate) ? 0 : -1}
                              onFocus={() => setActiveDate(date)}
                              onClick={() => handleSelectDay(date)}
                              className={cn(
                                "relative z-10 flex size-9 items-center justify-center rounded-full text-[13px] tabular-nums",
                                "outline-none transition-colors duration-150",
                                "focus-visible:bg-secondary focus-visible:text-secondary-foreground",
                                state.outsideMonth
                                  ? "text-[var(--muted-foreground)]/40"
                                  : "text-[var(--foreground)]",
                                !state.isSelected &&
                                  !state.isDayDisabled &&
                                  "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))]",
                                state.isSelected &&
                                  "bg-[color:var(--primitive-control-solid,var(--primary))] text-[color:var(--primitive-control-solid-foreground,var(--primary-foreground))] hover:bg-[color:var(--primitive-control-solid-hover,color-mix(in_srgb,var(--primary)_90%,var(--background)))]",
                                state.isToday &&
                                  !state.isSelected &&
                                  "border border-[var(--border)] font-semibold",
                                state.isDayDisabled &&
                                  !state.isBookedDay &&
                                  "pointer-events-none text-[var(--muted-foreground)] opacity-30",
                                state.isBookedDay &&
                                  "pointer-events-none text-[var(--muted-foreground)]/50 line-through",
                              )}
                            >
                              {fa(String(jalaliParts(date).jd))}
                              {state.event && !state.isSelected && (
                                <span className="absolute bottom-0.5 size-1 rounded-full bg-[color:var(--primitive-info,#0ea5e9)]" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {navView === "months" && (
              <motion.div
                key="months"
                onAnimationComplete={focusEnteringView}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: prefersReducedMotion ? 0.12 : 0.15,
                  ease: EASE_OUT,
                }}
                className="grid grid-cols-3 gap-1 py-1"
              >
                {MONTH_NAMES.map((name, i) => (
                  <button
                    key={name}
                    data-calendar-focus={i === displayMonth - 1 || undefined}
                    type="button"
                    aria-pressed={i === displayMonth - 1}
                    onClick={() => {
                      const next = fromJalali(displayYear, i + 1, 1);
                      if (selectionMode === "month") handleSelectDay(next);
                      else {
                        setMonth(next, 1);
                        showView("days");
                      }
                    }}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-[var(--primitive-radius-control-sm,0.625rem)] text-[13px] text-[var(--foreground)]",
                      "outline-none transition-colors duration-150",
                      "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))]",
                      i === displayMonth - 1 &&
                        "bg-[color:var(--primitive-control-solid,var(--primary))] text-[color:var(--primitive-control-solid-foreground,var(--primary-foreground))]",
                    )}
                  >
                    {name}
                  </button>
                ))}
              </motion.div>
            )}

            {navView === "years" && (
              <motion.div
                key="years"
                onAnimationComplete={focusEnteringView}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: prefersReducedMotion ? 0.12 : 0.15,
                  ease: EASE_OUT,
                }}
              >
                <p
                  className="mb-1 py-2 text-center text-[11px] text-muted-foreground"
                  aria-live="polite"
                >
                  {fa(String(yearAnchor - 5))} تا {fa(String(yearAnchor + 6))}
                </p>

                <div className="grid grid-cols-3 gap-1 py-1">
                  {Array.from({ length: 12 }, (_, i) => yearAnchor - 5 + i).map(
                    (year) => (
                      <button
                        key={year}
                        data-calendar-focus={year === displayYear || undefined}
                        type="button"
                        onClick={() => {
                          setMonth(fromJalali(year, displayMonth, 1), 1);
                          showView("months");
                        }}
                        className={cn(
                          "flex h-10 items-center justify-center rounded-[var(--primitive-radius-control-sm,0.625rem)] text-[13px] tabular-nums text-[var(--foreground)]",
                          "outline-none transition-colors duration-150",
                          "hover:bg-[color:var(--primitive-surface-hover,color-mix(in_srgb,var(--foreground)_4%,transparent))]",
                          year === displayYear &&
                            "bg-[color:var(--primitive-control-solid,var(--primary))] text-[color:var(--primitive-control-solid-foreground,var(--primary-foreground))]",
                        )}
                      >
                        {fa(String(year))}
                      </button>
                    ),
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  },
);
Calendar.displayName = "Calendar";

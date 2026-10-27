"use client";

import { useId, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { FieldHint } from "@/components/ui/field-hint";
import {
  formatJalaliDate,
  formatJalaliMonthLabel,
  fromJalali,
  isoDate,
  jalaliParts,
} from "@/lib/format/jalali";

export function JalaliDateField({
  name,
  label,
  defaultValue,
  value,
  onChange,
  required = false,
  hint,
  mode = "day",
  referenceDate,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  hint?: string;
  mode?: "day" | "month";
  referenceDate?: string;
}) {
  const id = useId();
  const [localValue, setLocalValue] = useState(defaultValue ?? "");
  const date = value ?? localValue;
  const today = jalaliParts(new Date());
  const anchor = date
    ? new Date(date)
    : referenceDate
      ? new Date(referenceDate)
      : new Date();
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [month, setMonth] = useState(anchor);
  const calendar = useRef<HTMLDivElement>(null);
  const commit = (next: string) => {
    setLocalValue(next);
    onChange?.(next);
    setInvalid(false);
    setOpen(false);
  };
  const changeOpen = (next: boolean) => {
    if (next) setMonth(anchor);
    setOpen(next);
  };
  return (
    <div className="form-field min-w-0">
      <div className="flex min-h-7 items-center gap-1">
        <label htmlFor={id}>{label}</label>
        {hint && <FieldHint label={label}>{hint}</FieldHint>}
      </div>
      <input
        name={name}
        value={date}
        onChange={() => {}}
        type="text"
        tabIndex={-1}
        aria-label={label}
        className="sr-only"
        required={required}
        aria-hidden="true"
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          changeOpen(true);
        }}
      />
      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            data-invalid={invalid}
            aria-describedby={invalid ? `${id}-error` : undefined}
            className="form-control flex w-full items-center justify-between gap-2 text-right data-[invalid=true]:border-destructive"
          >
            <span
              className={date ? "text-foreground" : "text-muted-foreground"}
            >
              {date
                ? mode === "month"
                  ? formatJalaliMonthLabel(new Date(date))
                  : formatJalaliDate(new Date(date))
                : "انتخاب تاریخ"}
            </span>
            <CalendarIcon
              size={18}
              className="shrink-0 text-muted-foreground"
            />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            ref={calendar}
            dir="rtl"
            aria-label={`تقویم ${label}`}
            sideOffset={8}
            align="start"
            collisionPadding={12}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              requestAnimationFrame(() =>
                calendar.current
                  ?.querySelector<HTMLButtonElement>(
                    '[data-calendar-focus="true"]',
                  )
                  ?.focus(),
              );
            }}
            className="motion-pop z-[70] w-[min(300px,calc(100vw-24px))] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-2xl border border-border bg-card text-foreground shadow-xl outline-none"
          >
            <Calendar
              mode="single"
              selectionMode={mode}
              selected={date ? new Date(date) : undefined}
              toggleSelection={false}
              month={month}
              onMonthChange={setMonth}
              onSelect={(selected) => {
                if (selected) commit(isoDate(selected));
              }}
              className="max-w-none rounded-none border-0 bg-transparent"
            />
            <div className="mx-3 flex items-center justify-between border-t border-border py-2">
              <button
                type="button"
                className="min-h-9 rounded-lg px-3 text-xs font-medium text-primary hover:bg-muted"
                onClick={() =>
                  commit(
                    isoDate(
                      fromJalali(
                        today.jy,
                        today.jm,
                        mode === "month" ? 1 : today.jd,
                      ),
                    ),
                  )
                }
              >
                {mode === "month" ? "ماه جاری" : "امروز"}
              </button>
              {!required && date && (
                <button
                  type="button"
                  className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted"
                  onClick={() => commit("")}
                >
                  <X size={14} />
                  پاک‌کردن تاریخ
                </button>
              )}
              <Popover.Close className="min-h-9 rounded-lg px-3 text-xs text-muted-foreground hover:bg-muted">
                بستن
              </Popover.Close>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {invalid && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          تاریخ را انتخاب کنید.
        </p>
      )}
    </div>
  );
}

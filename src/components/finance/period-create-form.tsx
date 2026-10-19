"use client";

import { useId, useState } from "react";
import { CalendarBlank, Info, WarningCircle } from "@phosphor-icons/react";
import { ActionForm } from "@/components/finance/forms";
import { JalaliDateField } from "@/components/finance/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldHint } from "@/components/ui/field-hint";
import { editPeriod } from "@/lib/actions/management";
import type { EditablePeriod } from "./period-actions";
import { createBillingPeriod } from "@/lib/actions/building";
import {
  periodOptions,
  presetPeriodRange,
  type PeriodType,
} from "@/lib/billing/periods";
import {
  formatJalaliDate,
  formatJalaliMonthLabel,
  isoDate,
  nextJalaliDueDate,
} from "@/lib/format/jalali";

function suggestedTitle(start: string, type: PeriodType) {
  const label = periodOptions.find((option) => option.value === type)!.label;
  return `شارژ${type === "monthly" || type === "custom" ? "" : ` ${label}`} ${formatJalaliMonthLabel(new Date(start))}`;
}

export function PeriodCreateForm({
  initial,
  defaultDueDay,
}: {
  initial?: EditablePeriod;
  defaultDueDay?: number;
}) {
  const id = useId();
  const [type, setType] = useState<PeriodType>(
    initial?.periodType ?? "monthly",
  );
  const [range, setRange] = useState(() =>
    initial
      ? {
          startDate: isoDate(new Date(initial.startDate)),
          endDate: isoDate(new Date(initial.endDate)),
        }
      : presetPeriodRange(isoDate(new Date()), "monthly"),
  );
  const [title, setTitle] = useState(
    () => initial?.title ?? suggestedTitle(range.startDate, type),
  );
  const [titleEdited, setTitleEdited] = useState(!!initial);
  const [due, setDue] = useState(
    initial?.dueDate ? isoDate(new Date(initial.dueDate)) : "",
  );
  const rangeInvalid =
    !range.startDate || !range.endDate || range.endDate < range.startDate;
  const calculationChanged =
    initial &&
    (type !== initial.periodType ||
      range.startDate !== isoDate(new Date(initial.startDate)) ||
      range.endDate !== isoDate(new Date(initial.endDate)));
  const changeType = (next: PeriodType) => {
    setType(next);
    const nextRange =
      next === "custom" ? range : presetPeriodRange(range.startDate, next);
    setRange(nextRange);
    if (!titleEdited) setTitle(suggestedTitle(nextRange.startDate, next));
  };
  return (
    <ActionForm
      action={async () => {
        if (rangeInvalid)
          throw new Error("پایان دوره نباید قبل از شروع آن باشد.");
        const values = {
          title,
          periodType: type,
          ...range,
          dueDate: due || undefined,
        };
        if (initial) await editPeriod(initial.id, values);
        else await createBillingPeriod(values);
      }}
      className="form-grid !gap-y-4"
    >
      <fieldset className="col-span-full min-w-0">
        <legend className="mb-2 flex items-center gap-1 text-xs font-semibold">
          طول دوره
          <FieldHint label="طول دوره">
            هزینه‌های این بازه در یک دوره محاسبه می‌شوند. گزینه‌های یک، دو و
            سه‌ماهه شامل ماه‌های کامل شمسی‌اند؛ برای انتخاب روز شروع و پایان از
            «بازه دلخواه» استفاده کنید.
          </FieldHint>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {periodOptions.map((option) => (
            <label key={option.value} className="relative cursor-pointer">
              <input
                type="radio"
                name={`${id}-period-type`}
                value={option.value}
                checked={type === option.value}
                onChange={() => changeType(option.value)}
                className="peer sr-only"
              />
              <span className="flex min-h-11 items-center justify-center rounded-lg border border-input px-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 peer-checked:border-primary peer-checked:bg-secondary peer-checked:font-bold peer-checked:text-primary peer-focus-visible:border-primary peer-focus-visible:bg-secondary">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-field col-span-full">
        <div className="flex min-h-7 items-center gap-1">
          <label htmlFor={`${id}-title`}>نام دوره</label>
          <FieldHint label="نام دوره">
            این نام روی فیش‌ها و گزارش‌ها نمایش داده می‌شود؛ مثلاً «شارژ مهر و
            آبان ۱۴۰۵». تغییر نام، مبلغ فیش‌ها را عوض نمی‌کند.
          </FieldHint>
        </div>
        <Input
          id={`${id}-title`}
          name="title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleEdited(true);
          }}
          required
          maxLength={200}
        />
      </div>
      <JalaliDateField
        name="startDate"
        label={type === "custom" ? "از تاریخ" : "ماه شروع"}
        mode={type === "custom" ? "day" : "month"}
        value={range.startDate}
        required
        hint={
          type === "custom"
            ? "اولین روز بازه محاسبه هزینه‌های این دوره."
            : "ماه شروع را انتخاب کنید؛ دوره از روز اول این ماه آغاز می‌شود و پایان آن خودکار محاسبه می‌شود."
        }
        onChange={(startDate) => {
          setRange(
            type === "custom"
              ? { ...range, startDate }
              : presetPeriodRange(startDate, type),
          );
          if (!titleEdited) setTitle(suggestedTitle(startDate, type));
        }}
      />
      {type === "custom" ? (
        <JalaliDateField
          name="endDate"
          label="تا تاریخ"
          value={range.endDate}
          required
          hint="آخرین روز بازه محاسبه هزینه‌ها؛ این تاریخ با مهلت پرداخت ساکنان فرق دارد."
          onChange={(endDate) => setRange({ ...range, endDate })}
        />
      ) : (
        <div className="form-field min-w-0">
          <div className="flex min-h-7 items-center gap-1">
            <span className="text-xs font-semibold">پایان دوره</span>
            <FieldHint label="پایان دوره">
              آخرین روز ماه پایانی دوره به‌صورت خودکار انتخاب شده است. برای
              تغییر روزها، «بازه دلخواه» را انتخاب کنید.
            </FieldHint>
            <span className="ms-auto text-[10px] text-muted-foreground">
              خودکار
            </span>
          </div>
          <div className="flex min-h-11 items-center justify-between rounded-lg border border-border bg-muted/50 px-3 text-sm">
            <span>{formatJalaliDate(new Date(range.endDate))}</span>
            <CalendarBlank size={18} className="text-muted-foreground" />
          </div>
        </div>
      )}
      {rangeInvalid && (
        <p role="alert" className="col-span-full text-xs text-destructive">
          پایان دوره نباید قبل از شروع آن باشد.
        </p>
      )}
      <div className="col-span-full grid gap-x-5 gap-y-2 border-t border-border pt-4 sm:grid-cols-2">
        <JalaliDateField
          name="dueDate"
          label="مهلت پرداخت شارژ"
          referenceDate={
            defaultDueDay
              ? isoDate(
                  nextJalaliDueDate(new Date(range.endDate), defaultDueDay),
                )
              : range.endDate
          }
          value={due}
          onChange={setDue}
          hint="آخرین روزی که ساکنان برای پرداخت فیش این دوره فرصت دارند. مثلاً شارژ مهر می‌تواند تا ۱۰ آبان پرداخت شود. تغییر این تاریخ، مبلغ فیش‌ها را تغییر نمی‌دهد."
        />
        <p className="self-center text-xs leading-6 text-muted-foreground">
          {due ? (
            "ساکنان تا این تاریخ فرصت پرداخت دارند. مبلغ شارژ با تغییر مهلت پرداخت عوض نمی‌شود."
          ) : initial ? (
            "برای این دوره مهلت پرداختی تعیین نشده است. می‌توانید یک تاریخ انتخاب کنید."
          ) : defaultDueDay ? (
            <>
              مهلت پیش‌فرض:{" "}
              <span className="font-medium text-foreground">
                {formatJalaliDate(
                  nextJalaliDueDate(new Date(range.endDate), defaultDueDay),
                )}
              </span>
              <br />
              طبق تنظیم ساختمان؛ برای تغییر، تاریخ انتخاب کنید.
            </>
          ) : (
            "اگر تاریخی انتخاب نکنید، مهلت پرداخت از تنظیم ساختمان و ماه بعد از پایان دوره محاسبه می‌شود."
          )}
        </p>
      </div>
      {initial && (
        <p
          role="status"
          className={`col-span-full flex items-start gap-2 rounded-lg p-3 text-xs leading-6 ${calculationChanged && initial.status !== "draft" ? "bg-[var(--warning-bg)] text-[var(--warning)]" : "bg-muted/60 text-muted-foreground"}`}
        >
          {calculationChanged && initial.status !== "draft" ? (
            <>
              <WarningCircle size={18} className="mt-0.5 shrink-0" />
              با ذخیره این بازه، فیش‌های فعلی باطل می‌شوند و باید دوباره صادرشان
              کنید. واریزهای ثبت‌شده حفظ می‌شوند.
            </>
          ) : (
            <>
              <Info size={18} className="mt-0.5 shrink-0" />
              {initial.status === "draft"
                ? "سهم واحدها پس از ذخیره، بر اساس بازه جدید محاسبه می‌شود."
                : "تغییر نام یا مهلت پرداخت، فیش‌های صادرشده را تغییر نمی‌دهد."}
            </>
          )}
        </p>
      )}
      <Button
        type="submit"
        disabled={rangeInvalid}
        className="col-span-full w-full sm:ms-auto sm:w-fit"
      >
        {initial ? "ذخیره تغییرات دوره" : "ایجاد دوره"}
      </Button>
    </ActionForm>
  );
}

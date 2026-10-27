"use client";
import {
  allocateChargeForecast,
  type ForecastCategory,
} from "@/lib/billing/forecast";
import { useState } from "react";
import { SlidersHorizontal, Info } from "lucide-react";
import { formatToman, toPersianDigits as fa } from "@/lib/format/money";
import { formatJalaliDate } from "@/lib/format/jalali";
import { EmptyState } from "@/components/finance/forms";
import { DataGrid } from "@/components/finance/data-grid";
export function BudgetPlanner({
  breakdown,
  units,
  computedAt,
}: {
  breakdown: ForecastCategory[];
  units: {
    id: string;
    label: string;
    occupants: number;
    empty: boolean;
    temporarilyAbsent: boolean;
  }[];
  computedAt: string | null;
}) {
  const [adjust, setAdjust] = useState(0),
    [reserve, setReserve] = useState(10);
  if (!breakdown.length)
    return (
      <section className="panel">
        <EmptyState
          title="پیشنهاد بر پایه هزینه‌های خودتان"
          description="پس از نهایی‌کردن اولین دوره، میانگین را محاسبه کنید تا بتوانید سناریوی افزایش یا کاهش شارژ را بررسی کنید."
        />
      </section>
    );
  const base = breakdown.reduce((s, r) => s + r.averageRial, 0);
  const { adjusted, total, withReserve, preview, unallocatedRial } =
    allocateChargeForecast(
      units.map((u) => ({
        unitId: u.id,
        label: u.label,
        occupantCount: u.occupants,
        status: u.empty ? "empty" : "occupied",
        temporarilyAbsent: u.temporarilyAbsent,
      })),
      breakdown,
      adjust,
      reserve,
    );
  const rows = units.map((u) => ({
    unit: `واحد ${u.label}`,
    persons: u.temporarilyAbsent
      ? "غایب موقت · ۰ نفر حاضر"
      : u.empty
        ? "خالی"
        : `${fa(String(u.occupants))} نفر`,
    suggested: preview.byUnit[u.id]?.totalRial ?? 0,
  }));
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_1.4fr]">
      <section className="panel p-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={21} className="text-primary" />
          <h2 className="panel-title">سناریوی شارژ آینده</h2>
        </div>
        <p className="mb-6 mt-2 text-[11px] text-muted-foreground">
          محاسبه‌شده در{" "}
          {computedAt ? formatJalaliDate(new Date(computedAt)) : "امروز"}
        </p>
        <div className="mb-6 rounded-xl bg-secondary p-5">
          <p className="text-xs text-muted-foreground">
            بودجه پیشنهادی ماهانه کل ساختمان
          </p>
          <p className="mt-3 text-[26px] font-bold text-primary">
            {formatToman(withReserve)}
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            بودجه پایه بدون تعدیل: {formatToman(base)}
          </p>
        </div>
        <label htmlFor="adjust" className="flex justify-between text-xs">
          <span>تغییر عمومی قیمت‌ها</span>
          <strong>{fa(String(adjust))}٪</strong>
        </label>
        <input
          id="adjust"
          className="my-4 w-full accent-[var(--primary)]"
          type="range"
          min={-50}
          max={100}
          step={5}
          value={adjust}
          onChange={(e) => setAdjust(+e.target.value)}
        />
        <p className="mb-6 text-[10px] leading-6 text-muted-foreground">
          این درصد به تعدیل اختصاصی هر دسته اضافه می‌شود. برای تغییر دائمی،
          قواعد تقسیم هزینه را ویرایش کنید.
        </p>
        <label htmlFor="reserve" className="flex justify-between text-xs">
          <span>ذخیره هزینه‌های پیش‌بینی‌نشده</span>
          <strong>{fa(String(reserve))}٪</strong>
        </label>
        <input
          id="reserve"
          className="my-4 w-full accent-[var(--primary)]"
          type="range"
          min={0}
          max={30}
          step={5}
          value={reserve}
          onChange={(e) => setReserve(+e.target.value)}
        />
        <p className="flex items-start gap-2 border-t border-border pt-4 text-[10px] leading-6 text-muted-foreground">
          <Info size={16} className="mt-1 shrink-0" />
          این اعداد برآورد هستند و فیشی صادر نمی‌کنند. برای دریافت شارژ، دوره
          بعد را ایجاد و هزینه‌های آن را ثبت کنید.
        </p>
      </section>
      <div className="space-y-5">
        {unallocatedRial > 0 && (
          <p
            role="alert"
            className="rounded-xl border border-border bg-secondary p-4 text-xs leading-7"
          >
            {formatToman(unallocatedRial)} سهم‌بندی نشده است؛ برای هزینه
            نفرمحور، نفر حاضر و برای هزینه واحدمحور، واحد مشمول لازم است. تا
            اصلاح شرایط، این مبلغ در سهم واحدها نیامده است.
          </p>
        )}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">سهم پیشنهادی هر واحد</h2>
          </div>
          <DataGrid
            data={rows}
            filename="charge-forecast"
            searchPlaceholder="جست‌وجوی واحد"
            columns={[
              { key: "unit", label: "واحد" },
              { key: "persons", label: "جمعیت" },
              { key: "suggested", label: "پیشنهاد ماهانه", type: "money" },
            ]}
          />
        </section>
        <section className="panel p-6">
          <h2 className="panel-title">جزئیات بودجه پیشنهادی</h2>
          {adjusted.map((r) => (
            <div
              key={r.categoryId}
              className="mt-4 flex justify-between gap-3 border-t border-border pt-4 text-xs"
            >
              <span className="text-muted-foreground">{r.name}</span>
              <span>{formatToman(r.adjusted)}</span>
            </div>
          ))}
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-xs">
            <span className="text-muted-foreground">ذخیره ساختمان</span>
            <span>{formatToman(withReserve - total)}</span>
          </div>
        </section>
      </div>
    </div>
  );
}

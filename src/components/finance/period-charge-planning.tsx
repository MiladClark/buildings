"use client";
import { useId, useState } from "react";
import {
  Calculator,
  PencilSimple,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { ActionButton, ActionForm, FormModal } from "./forms";
import { MoneyInput } from "./money-input";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FieldHint } from "@/components/ui/field-hint";
import { Button } from "@/components/ui/button";
import {
  formatToman,
  tomanInputToRial,
  toPersianDigits as fa,
} from "@/lib/format/money";
import { formatJalaliDate } from "@/lib/format/jalali";
import {
  saveChargeBudget,
  saveManualMonthlyCharge,
} from "@/lib/actions/charge-plan";
import type { BudgetMode } from "@/lib/billing/charge-plan";
import type { PeriodChargePlanning } from "@/lib/queries/charge-plan";

const modes: Record<BudgetMode, string> = {
  monthly: "هزینه تکرارشونده ماهانه",
  bill: "قبض با بازه چندماهه",
  reserve: "ذخیره ماهانه تعمیرات",
  separate: "جدا از شارژ پایه",
  one_off: "خرید یا هزینه یک‌باره",
};

export function PeriodChargePlanningCards({
  periodId,
  plan,
}: {
  periodId: string;
  plan: PeriodChargePlanning;
}) {
  const manualId = useId();
  return (
    <div className="space-y-3">
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <section
          className="panel flex flex-col p-5 sm:p-6"
          aria-label="شارژ پیشنهادی اپ"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Calculator size={20} className="text-primary" />
              شارژ پیشنهادی اپ
            </h2>
            <FieldHint label="شارژ پیشنهادی اپ">
              برآورد ماهانه بر اساس میانگین هزینه‌ها و طول دوره قبض است. خرید
              یک‌باره و آب نفرمحور وارد پایه نمی‌شوند. ذخیره تعمیرات مبلغی مستقل
              و قابل تنظیم است.
            </FieldHint>
          </div>
          <p
            className={`mt-5 text-2xl font-bold ${plan.complete ? "text-primary" : "text-muted-foreground"}`}
          >
            {plan.complete
              ? formatToman(plan.suggestedMonthlyRial)
              : "نیاز به تنظیم مبنا"}
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            ماهانه برای هر واحد · تقسیم بین {fa(String(plan.unitCount))} واحد،
            شامل واحدهای خالی و غایب
          </p>
          {!plan.complete && (
            <p className="mt-3 text-xs leading-6 text-[var(--warning)]">
              {plan.unitCount === 0
                ? "ابتدا واحدهای ساختمان را ثبت کنید."
                : plan.missingCategories.length
                  ? `بازه قبض یا ذخیره این موارد مشخص نیست: ${plan.missingCategories.join("، ")}`
                  : "برای برآورد، هزینه تکرارشونده یا ذخیره ماهانه‌ای ثبت نشده است."}
            </p>
          )}
          {plan.complete && (
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {plan.preliminary ? "برآورد اولیه با سابقه محدود؛ " : ""}شامل{" "}
              {fa(String(plan.bufferPercent))}٪ حاشیه نوسان هزینه‌ها
            </p>
          )}
          <div className="mt-auto pt-5">
            <FormModal
              title="مبنای محاسبه شارژ"
              description="بازه واقعی قبض، هزینه‌های تکرارشونده و ذخیره تعمیرات را تنظیم کنید. این تنظیمات مبلغ هزینه‌های واقعی یا فیش‌ها را تغییر نمی‌دهند."
              contentClassName="max-w-3xl"
              trigger={
                <Button variant="outline" size="sm">
                  <SlidersHorizontal size={16} />
                  تنظیم مبنای محاسبه
                </Button>
              }
            >
              <BudgetSettings
                key={JSON.stringify(plan)}
                periodId={periodId}
                plan={plan}
              />
            </FormModal>
          </div>
        </section>
        <section
          className="panel flex flex-col p-5 sm:p-6"
          aria-label="شارژ ثابت دستی"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">شارژ ثابت دستی</h2>
            <FieldHint label="شارژ ثابت دستی">
              مبلغ ماهانه‌ای که مدیر برای هر واحد در نظر می‌گیرد. برای همین دوره
              ذخیره می‌شود؛ به‌خودی‌خود بدهی یا هزینه تازه ایجاد نمی‌کند و از
              حساب واحدها برداشت نمی‌شود.
            </FieldHint>
          </div>
          <p className="mt-5 text-2xl font-bold">
            {plan.manualMonthlyRial === null
              ? "تعیین نشده"
              : formatToman(plan.manualMonthlyRial)}
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            ماهانه برای هر واحد · مبلغ انتخابی مدیر برای این دوره
          </p>
          {plan.manualMonthlyRial !== null && plan.periodMonths > 1 && (
            <p className="mt-3 text-xs text-muted-foreground">
              برای دوره {fa(String(plan.periodMonths))}ماهه:{" "}
              {formatToman(plan.manualMonthlyRial * plan.periodMonths)} برای هر
              واحد
            </p>
          )}
          {plan.manualMonthlyRial !== null && plan.complete && (
            <p
              className={`mt-3 text-xs leading-6 ${plan.manualMonthlyRial < plan.suggestedMonthlyRial ? "text-[var(--warning)]" : "text-primary"}`}
            >
              {plan.manualMonthlyRial === plan.suggestedMonthlyRial ? (
                "برابر با پیشنهاد ماهانه اپ"
              ) : (
                <>
                  {formatToman(
                    Math.abs(
                      plan.manualMonthlyRial - plan.suggestedMonthlyRial,
                    ),
                  )}{" "}
                  {plan.manualMonthlyRial < plan.suggestedMonthlyRial
                    ? "کمتر"
                    : "بیشتر"}{" "}
                  از پیشنهاد ماهانه اپ
                </>
              )}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <FormModal
              title="تعیین شارژ ثابت دستی"
              description="مبلغ ماهانه هر واحد را برای برنامه‌ریزی همین دوره ثبت کنید؛ این کار مبلغ فیش‌های فعلی را عوض نمی‌کند."
              trigger={
                <Button variant="outline" size="sm">
                  <PencilSimple size={16} />
                  {plan.manualMonthlyRial === null
                    ? "تعیین مبلغ"
                    : "ویرایش مبلغ"}
                </Button>
              }
            >
              <ActionForm
                className="space-y-5"
                action={async (f) =>
                  saveManualMonthlyCharge(
                    periodId,
                    tomanInputToRial(f.get("manualToman")),
                  )
                }
                success="شارژ ثابت دستی این دوره ذخیره شد."
              >
                <div className="form-field">
                  <label htmlFor={manualId}>شارژ ماهانه هر واحد (تومان)</label>
                  <MoneyInput
                    id={manualId}
                    name="manualToman"
                    defaultRial={plan.manualMonthlyRial ?? undefined}
                    placeholder="مثلاً ۳۰۰٬۰۰۰"
                    required
                  />
                </div>
                <p className="text-xs leading-7 text-muted-foreground">
                  آب طبق نفرات حاضر و هزینه‌های موردی طبق قواعد ساختمان جدا حساب
                  می‌شوند. این مبلغ صرفاً بودجه پیشنهادی مدیر است.
                </p>
                <Button type="submit">ذخیره مبلغ ثابت</Button>
              </ActionForm>
            </FormModal>
            {plan.manualMonthlyRial !== null && (
              <ActionButton
                variant="ghost"
                action={() => saveManualMonthlyCharge(periodId, null)}
                success="مبلغ دستی پاک شد."
              >
                پاک کردن مبلغ
              </ActionButton>
            )}
          </div>
        </section>
      </div>
      <p className="px-1 text-[11px] leading-7 text-muted-foreground">
        این دو عدد برای برنامه‌ریزی ماهانه‌اند؛ مبلغ فیش‌ها از هزینه‌های ثبت‌شده
        و قواعد تقسیم محاسبه می‌شود. قبض چندماهه در برآورد ماهانه سرشکن می‌شود و
        خرید یک‌باره دوباره به شارژ ماه‌های بعد اضافه نمی‌شود.
      </p>
    </div>
  );
}

function BudgetSettings({
  periodId,
  plan,
}: {
  periodId: string;
  plan: PeriodChargePlanning;
}) {
  const [policies, setPolicies] = useState(
    plan.breakdown.map((b) => ({ ...b.policy })),
  );
  const prefix = useId();
  const setMode = (categoryId: string, mode: BudgetMode) =>
    setPolicies((current) =>
      current.map((p) => (p.categoryId === categoryId ? { ...p, mode } : p)),
    );
  return (
    <ActionForm
      className="space-y-6"
      success="مبنای محاسبه ذخیره و پیشنهاد به‌روز شد."
      action={async (f) => {
        const optionalMonths = (value: FormDataEntryValue | null) =>
          value && value !== "unknown" ? Number(value) : null;
        await saveChargeBudget(periodId, {
          bufferPercent: Number(f.get("buffer")),
          roundToRial: Number(f.get("round")),
          policies: policies.map((p) => ({
            ...p,
            intervalMonths:
              p.mode === "bill"
                ? optionalMonths(f.get(`interval-${p.categoryId}`))
                : p.intervalMonths,
            monthlyReserveRial:
              p.mode === "reserve"
                ? String(f.get(`reserve-${p.categoryId}`) ?? "").trim()
                  ? tomanInputToRial(f.get(`reserve-${p.categoryId}`))
                  : null
                : p.monthlyReserveRial,
          })),
          coverage: plan.breakdown.flatMap((b) =>
            policies.find((p) => p.categoryId === b.categoryId)?.mode === "bill"
              ? b.expenses.map((e) => ({
                  expenseId: e.id,
                  months: optionalMonths(f.get(`coverage-${e.id}`)),
                }))
              : [],
          ),
        });
      }}
    >
      <div className="rounded-xl bg-muted p-4 text-xs leading-7 text-muted-foreground">
        قبض آب یا برق لزوماً ماهانه نیست؛ طول دوره واقعی قبض را وارد کنید.
        میانگین قبض‌ها برابر مجموع مبالغ تقسیم بر مجموع ماه‌های پوشش‌داده‌شده
        است. هزینه ماهانه از آخرین دوره دارای هزینه گرفته می‌شود تا نرخ جدید
        نظافت لحاظ شود؛ چند نوبت نظافت همان دوره با هم جمع می‌شوند.
      </div>
      {plan.breakdown.map((b) => {
        const policy = policies.find((p) => p.categoryId === b.categoryId)!;
        return (
          <section
            key={b.categoryId}
            className="rounded-xl border border-border p-4"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{b.name}</h3>
              <span className="text-[11px] text-muted-foreground">
                مبنای ماهانه فعلی:{" "}
                {b.policy.mode === "one_off" || b.policy.mode === "separate"
                  ? "خارج از پایه"
                  : b.missing
                    ? "نیازمند تنظیم"
                    : formatToman(b.monthlyRial)}
              </span>
            </div>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <div className="form-field">
                <label htmlFor={`${prefix}-${b.categoryId}`}>
                  نحوه ورود به پیشنهاد
                </label>
                <Select
                  id={`${prefix}-${b.categoryId}`}
                  value={policy.mode}
                  onValueChange={(v) => setMode(b.categoryId, v as BudgetMode)}
                >
                  {(b.perPerson ? ["separate"] : Object.keys(modes)).map(
                    (key) => (
                      <option key={key} value={key}>
                        {modes[key as BudgetMode]}
                      </option>
                    ),
                  )}
                </Select>
              </div>
              {policy.mode === "bill" && (
                <div className="form-field">
                  <label htmlFor={`${prefix}-interval-${b.categoryId}`}>
                    بازه پیش‌فرض قبض‌های بدون بازه{" "}
                    <FieldHint label={`بازه قبض ${b.name}`}>
                      فقط برای قبض‌هایی استفاده می‌شود که بازه اختصاصی ندارند.
                      برای قبض‌های دوماهه و سه‌ماهه می‌توانید در ردیف هر قبض،
                      بازه جدا تعیین کنید.
                    </FieldHint>
                  </label>
                  <Select
                    id={`${prefix}-interval-${b.categoryId}`}
                    name={`interval-${b.categoryId}`}
                    defaultValue={
                      policy.intervalMonths
                        ? String(policy.intervalMonths)
                        : "unknown"
                    }
                  >
                    <option value="unknown">
                      نامشخص؛ از روی قبض تعیین شود
                    </option>
                    {Array.from({ length: 36 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {fa(String(i + 1))} ماه
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {policy.mode === "reserve" && (
                <div className="form-field">
                  <label htmlFor={`${prefix}-reserve-${b.categoryId}`}>
                    ذخیره ماهانه کل ساختمان (تومان)
                  </label>
                  <MoneyInput
                    id={`${prefix}-reserve-${b.categoryId}`}
                    name={`reserve-${b.categoryId}`}
                    defaultRial={policy.monthlyReserveRial ?? undefined}
                    placeholder="مبلغ دلخواه؛ صفر یعنی بدون ذخیره"
                  />
                </div>
              )}
            </div>
            {policy.mode === "reserve" && (
              <p className="mt-3 text-[11px] leading-6 text-muted-foreground">
                مبلغ یک تعمیر یا بازدید، هزینه هر ماه فرض نمی‌شود. مبلغ کوچکی که
                می‌خواهید ماهانه برای تعمیرات کنار بگذارید را وارد کنید؛ هزینه
                واقعی همچنان جدا ثبت می‌شود.
              </p>
            )}
            {policy.mode === "one_off" && (
              <p className="mt-3 text-[11px] leading-6 text-muted-foreground">
                این خرید در فیش دوره خودش باقی می‌ماند و در شارژ پایه ماه‌های
                بعد تکرار نمی‌شود.
              </p>
            )}
            {policy.mode === "separate" && (
              <p className="mt-3 text-[11px] leading-6 text-muted-foreground">
                خارج از شارژ پایه؛ سهم واقعی طبق قواعد تقسیم هزینه محاسبه
                می‌شود.{b.perPerson ? " واحد بدون فرد حاضر، سهم آب ندارد." : ""}
              </p>
            )}
            {policy.mode === "bill" && b.expenses.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <p className="text-[11px] text-muted-foreground">
                  بازه اختصاصی آخرین قبض‌ها؛ اولویت با این مقدار است.
                </p>
                {b.expenses.map((e) => (
                  <div
                    key={e.id}
                    className="grid items-center gap-3 sm:grid-cols-[1fr_180px]"
                  >
                    <label
                      htmlFor={`${prefix}-${e.id}`}
                      className="text-xs leading-6"
                    >
                      {formatToman(e.amountRial)} ·{" "}
                      {formatJalaliDate(new Date(e.expenseDate))}
                    </label>
                    <Select
                      id={`${prefix}-${e.id}`}
                      name={`coverage-${e.id}`}
                      defaultValue={
                        e.coverageMonths ? String(e.coverageMonths) : "unknown"
                      }
                    >
                      <option value="unknown">از بازه پیش‌فرض</option>
                      {Array.from({ length: 36 }, (_, i) => (
                        <option value={i + 1} key={i + 1}>
                          {fa(String(i + 1))} ماه
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="form-field">
          <label htmlFor={`${prefix}-buffer`}>
            حاشیه نوسان هزینه‌ها (درصد)
          </label>
          <Input
            id={`${prefix}-buffer`}
            name="buffer"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={plan.bufferPercent}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor={`${prefix}-round`}>گرد کردن پیشنهاد به بالا</label>
          <Select
            id={`${prefix}-round`}
            name="round"
            defaultValue={String(plan.roundToRial)}
          >
            {[100000, 250000, 500000, 1000000].map((n) => (
              <option key={n} value={n}>
                {formatToman(n)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="rounded-xl bg-muted p-4 text-xs leading-7">
        <p>
          جمع ماهانه مبنای فعلی:{" "}
          <strong>{formatToman(plan.monthlyBuildingRial)}</strong>
        </p>
        <p className="text-muted-foreground">
          برای قبض‌ها حداکثر ۶ قبض آخر، و برای هزینه ماهانه آخرین دوره دارای
          هزینه بررسی می‌شود. مبنای دسته‌ها و بازه قبض‌ها برای ساختمان ذخیره
          می‌شود؛ حاشیه نوسان و مبلغ دستی مخصوص این دوره است.
        </p>
      </div>
      <Button type="submit">ذخیره مبنا و محاسبه پیشنهاد</Button>
    </ActionForm>
  );
}

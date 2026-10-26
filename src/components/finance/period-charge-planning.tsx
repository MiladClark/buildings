"use client";
import { useId } from "react";
import { Calculator, PencilSimple } from "@phosphor-icons/react";
import { ActionButton, ActionForm, FormModal } from "./forms";
import { MoneyInput } from "./money-input";
import { Select } from "@/components/ui/select";
import { FieldHint } from "@/components/ui/field-hint";
import { Button } from "@/components/ui/button";
import {
  formatToman,
  tomanInputToRial,
  toPersianDigits as fa,
} from "@/lib/format/money";
import {
  saveManualMonthlyCharge,
  saveSmartChargeSettings,
} from "@/lib/actions/charge-plan";
import type { PeriodChargePlanning } from "@/lib/queries/charge-plan";

export function PeriodChargePlanningCards({
  periodId,
  plan,
}: {
  periodId: string;
  plan: PeriodChargePlanning;
}) {
  const prefix = useId();
  return (
    <div className="space-y-4">
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <section
          className="panel flex flex-col p-5 sm:p-6"
          aria-label="پیشنهاد شارژ پایه"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Calculator size={20} className="text-primary" />
              پیشنهاد شارژ پایه
            </h2>
            <FieldHint label="پیشنهاد شارژ">
              برآورد بودجه ماهانه است؛ آب در آن نیست. خریدها و تعمیرات به شکل
              ذخیره سرشکن می‌شوند. ده درصد برای نوسان هزینه‌ها در نظر گرفته شده؛
              پیشنهاد به‌خودی‌خود بدهی ایجاد نمی‌کند.
            </FieldHint>
          </div>
          <p className="mt-5 text-2xl font-bold text-primary">
            {plan.complete
              ? formatToman(plan.suggestedMonthlyRial)
              : "هنوز داده کافی نیست"}
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            ماهانه برای هر واحد · {fa(String(plan.unitCount))} واحد، شامل خالی و
            غایب
          </p>
          <div className="my-5 divide-y divide-border border-y border-border">
            {plan.breakdown.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-3 py-3 text-xs"
              >
                <span className="flex items-center gap-2">
                  {row.name}
                  <FieldHint label={row.name}>{fa(row.explanation)}</FieldHint>
                </span>
                <strong className="shrink-0 font-medium">
                  {formatToman(row.monthlyRial)}
                </strong>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-3 text-xs text-muted-foreground">
              <span>حاشیه نوسان ۱۰٪</span>
              <span>
                {formatToman(plan.withBufferRial - plan.monthlyBuildingRial)}
              </span>
            </div>
          </div>
          <p className="mb-4 text-xs leading-6 text-muted-foreground">
            {plan.preliminary
              ? "برآورد اولیه با سابقه محدود؛ "
              : "میانگین بر اساس سوابق ثبت‌شده؛ "}
            آب جداست، گاز اختصاصی وارد محاسبه نمی‌شود. ذخیره لوازم برای خرید
            احتمالی آینده است.
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            {plan.complete && (
              <ActionButton
                variant="outline"
                action={() =>
                  saveManualMonthlyCharge(periodId, plan.suggestedMonthlyRial)
                }
                confirm="مبلغ پیشنهادی به‌عنوان شارژ ماهانه این دوره ذخیره شود؟ هزینه‌های مشترک از محل همین شارژ تأمین می‌شوند؛ آب و هزینه فوق‌العاده جدا می‌مانند. دوره صادرشده برای اصلاح باز می‌شود."
                success="مبلغ پیشنهادی برای این دوره ذخیره شد."
              >
                استفاده از پیشنهاد
              </ActionButton>
            )}
            <FormModal
              title="برنامه نظافت"
              description="فقط نرخ هر نوبت و فاصله معمول نظافت را مشخص کنید. این تنظیم هزینه واقعی ثبت نمی‌کند و مبلغ انتخاب‌شده شارژ را خودکار تغییر نمی‌دهد."
              trigger={
                <Button variant="ghost" size="sm">
                  تنظیم نظافت
                </Button>
              }
            >
              <ActionForm
                className="space-y-5"
                success="برآورد نظافت به‌روز شد."
                action={async (f) =>
                  saveSmartChargeSettings(periodId, {
                    cleaningVisitRial: tomanInputToRial(f.get("visit")),
                    cleaningEveryDays: Number(f.get("days")),
                  })
                }
              >
                <div className="form-field">
                  <label htmlFor={`${prefix}-visit`}>
                    دستمزد هر نوبت نظافتچی (تومان)
                  </label>
                  <MoneyInput
                    id={`${prefix}-visit`}
                    name="visit"
                    defaultRial={plan.cleaningVisitRial ?? undefined}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`${prefix}-days`}>
                    معمولاً هر چند روز یک‌بار؟
                  </label>
                  <Select
                    id={`${prefix}-days`}
                    name="days"
                    defaultValue={String(plan.cleaningEveryDays)}
                  >
                    {[7, 14, 21, 30, 45, 60, 90].map((n) => (
                      <option key={n} value={n}>
                        هر {fa(String(n))} روز
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit">ذخیره برنامه نظافت</Button>
              </ActionForm>
            </FormModal>
          </div>
        </section>
        <section
          className="panel flex flex-col p-5 sm:p-6"
          aria-label="شارژ این دوره"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">شارژ این دوره</h2>
            <FieldHint label="شارژ پایه">
              بودجه مشترک ساختمان برای برق، نظافت، لوازم و تعمیرات است. این
              هزینه‌ها دوباره به بدهی اضافه نمی‌شوند. آب بر اساس نفرات حاضر و
              هزینه‌ای که صریحاً «دریافت جداگانه» انتخاب شود، جدا محاسبه می‌شود.
            </FieldHint>
          </div>
          <p className="mt-5 text-2xl font-bold">
            {plan.manualMonthlyRial == null
              ? "تعیین نشده"
              : formatToman(plan.manualMonthlyRial)}
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            ماهانه برای هر واحد · مبلغ انتخابی مدیر
          </p>
          <div className="my-5 rounded-xl bg-muted/50 p-4 text-xs leading-7">
            <p>برق مشترک، نظافت، آسانسور و لوازم از این شارژ تأمین می‌شوند.</p>
            <p className="text-muted-foreground">
              واحد خالی و غایب هم شارژ پایه می‌دهد؛ وقتی فرد حاضر ندارد، سهم آب
              ندارد.
            </p>
            {plan.periodMonths > 1 && plan.manualMonthlyRial != null && (
              <p className="mt-2">
                شارژ هر واحد در دوره {fa(String(plan.periodMonths))}ماهه:{" "}
                <strong>
                  {formatToman(plan.manualMonthlyRial * plan.periodMonths)}
                </strong>
              </p>
            )}
          </div>
          <div className="mt-auto">
            <FormModal
              title="تعیین شارژ ماهانه"
              description="با تعیین شارژ، هزینه‌های مشترک از همین مبلغ تأمین می‌شوند و دوباره به فیش اضافه نمی‌شوند. تغییر دوره صادرشده نیاز به صدور دوباره فیش دارد."
              trigger={
                <Button variant="outline" size="sm">
                  <PencilSimple size={16} />
                  {plan.manualMonthlyRial == null
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
                success="شارژ و حساب واحدها به‌روز شد."
              >
                <div className="form-field">
                  <label htmlFor={`${prefix}-manual`}>
                    شارژ ماهانه هر واحد (تومان)
                  </label>
                  <MoneyInput
                    id={`${prefix}-manual`}
                    name="manualToman"
                    defaultRial={plan.manualMonthlyRial ?? undefined}
                    required
                  />
                </div>
                <Button type="submit">ذخیره مبلغ شارژ</Button>
              </ActionForm>
            </FormModal>
          </div>
        </section>
      </div>
      {plan.fund && (
        <section className="panel p-5 sm:p-6" aria-label="بودجه دوره">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-semibold">بودجه دوره</h2>
            <FieldHint label="بودجه دوره">
              این اعداد بودجه و هزینه‌اند، موجودی نقدی حساب بانکی نیستند.
              واریزهای واقعی و بستانکاری هر واحد در دریافت و پرداخت‌ها ثبت
              می‌شوند. مانده بودجه متعلق به صندوق ساختمان است، نه بستانکاری شخصی
              واحدها.
            </FieldHint>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">جمع شارژ واحدها</p>
              <p className="mt-2 font-semibold">
                {formatToman(plan.chargeTotalRial)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                هزینه‌های تأمین‌شده از شارژ
              </p>
              <p className="mt-2 font-semibold">
                {formatToman(plan.coveredRial)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {plan.budgetRemainingRial < 0 ? "کسری بودجه" : "مانده بودجه"}
              </p>
              <p
                className={`mt-2 font-semibold ${plan.budgetRemainingRial < 0 ? "text-destructive" : "text-primary"}`}
              >
                {formatToman(Math.abs(plan.budgetRemainingRial))}
              </p>
            </div>
          </div>
          <p className="mt-4 border-t border-border pt-3 text-xs leading-6 text-muted-foreground">
            جمع قابل مطالبه این دوره، با آب و هزینه‌های جداگانه:{" "}
            <strong className="text-foreground">
              {formatToman(plan.payableRial)}
            </strong>
            . مانده بودجه، موجودی نقدی بانک نیست.
          </p>
        </section>
      )}
    </div>
  );
}

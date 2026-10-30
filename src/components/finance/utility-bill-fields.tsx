"use client";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { JalaliDateField } from "./calendar";
import { MoneyInput } from "./money-input";
import { utilityKinds, type UtilityBill } from "@/lib/billing/utility-bill";
import { formatJalaliDate } from "@/lib/format/jalali";
import { formatToman } from "@/lib/format/money";

export function UtilityBillFields({
  initial,
  categoryName = "",
  alwaysOpen = false,
}: {
  initial?: UtilityBill | null;
  categoryName?: string;
  alwaysOpen?: boolean;
}) {
  const id = useId();
  const [enabled, setEnabled] = useState(alwaysOpen || !!initial);
  const guess = categoryName.includes("برق")
    ? "electricity"
    : categoryName.includes("گاز")
      ? "gas"
      : "water";
  const [kind, setKind] = useState(initial?.kind ?? guess);
  const field = (
    name: string,
    label: string,
    defaultValue = "",
    numeric = false,
  ) => (
    <div className="form-field" key={name}>
      <label htmlFor={`${id}-${name}`}>{label}</label>
      <Input
        id={`${id}-${name}`}
        name={`bill_${name}`}
        defaultValue={defaultValue}
        maxLength={numeric ? 30 : 150}
        dir={numeric ? "ltr" : undefined}
        inputMode={numeric ? "decimal" : undefined}
      />
    </div>
  );
  return (
    <div className="col-span-full space-y-6 border-t border-border pt-5">
      <label className="flex items-center gap-3 text-xs font-medium">
        <input
          type="checkbox"
          name="hasUtilityBill"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        ثبت اطلاعات قبض آب، برق، گاز یا سایر خدمات
      </label>
      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            <div className="form-field">
              <label htmlFor={`${id}-kind`}>نوع قبض</label>
              <Select
                id={`${id}-kind`}
                name="bill_kind"
                value={kind}
                onValueChange={(v) => setKind(v as UtilityBill["kind"])}
              >
                {Object.entries(utilityKinds).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            {field("issuer", "شرکت صادرکننده", initial?.issuer)}
            {field("billId", "شناسه قبض", initial?.billId, true)}
            {field(
              "paymentId",
              "شناسه پرداخت این دوره",
              initial?.paymentId,
              true,
            )}
            {field(
              "subscriptionId",
              "شماره اشتراک / پرونده",
              initial?.subscriptionId,
            )}
            {field("meterNumber", "شماره کنتور", initial?.meterNumber)}
            <JalaliDateField
              name="bill_issuedOn"
              label="تاریخ صدور قبض"
              defaultValue={initial?.issuedOn}
            />
            <JalaliDateField
              name="bill_receivedOn"
              label="تاریخ دریافت قبض"
              defaultValue={initial?.receivedOn}
            />
            <JalaliDateField
              name="bill_dueOn"
              label="آخرین مهلت پرداخت قبض"
              defaultValue={initial?.dueOn}
            />
            <p className="text-xs leading-7 text-muted-foreground">
              یادآوری قبض بر اساس همین مهلت برای مدیران فرستاده می‌شود. سررسید
              شارژ واحدها مستقل است.
            </p>
          </div>
          <details
            className="rounded-lg border border-border p-4"
            open={!!initial?.periodStart || !!initial?.previousReading}
          >
            <summary className="text-xs font-medium">
              بازه مصرف، قرائت کنتور و ریز مبلغ (اختیاری)
            </summary>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6">
              <JalaliDateField
                name="bill_periodStart"
                label="تاریخ قرائت قبلی / شروع مصرف"
                defaultValue={initial?.periodStart}
              />
              <JalaliDateField
                name="bill_periodEnd"
                label="تاریخ قرائت فعلی / پایان مصرف"
                defaultValue={initial?.periodEnd}
              />
              {field(
                "previousReading",
                "عدد کنتور در قرائت قبلی",
                initial?.previousReading,
                true,
              )}
              {field(
                "currentReading",
                "عدد کنتور در قرائت فعلی",
                initial?.currentReading,
                true,
              )}
              {field(
                "consumption",
                `مصرف دوره (${kind === "electricity" ? "کیلووات‌ساعت" : "مترمکعب"})`,
                initial?.consumption,
                true,
              )}
              <div className="form-field">
                <label htmlFor={`${id}-debt`}>بدهی قبلی قبض (تومان)</label>
                <MoneyInput
                  id={`${id}-debt`}
                  name="bill_previousDebt"
                  defaultRial={initial?.previousDebtRial}
                />
              </div>
              <div className="form-field">
                <label htmlFor={`${id}-charge`}>
                  هزینه مصرف این دوره (تومان)
                </label>
                <MoneyInput
                  id={`${id}-charge`}
                  name="bill_currentCharge"
                  defaultRial={initial?.currentChargeRial}
                />
              </div>
              <p className="col-span-full text-xs leading-7 text-muted-foreground">
                مبلغ اصلی هزینه، کل مبلغ قابل پرداخت است. ریز مبلغ قبض اطلاعات
                تکمیلی است و دوباره به شارژ اضافه نمی‌شود. تاریخ پرداخت واقعی در
                «ثبت پرداخت» نگه‌داری می‌شود.
              </p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
export function UtilityBillDetails({ bill }: { bill: UtilityBill }) {
  const date = (v: string) =>
    v ? formatJalaliDate(new Date(`${v}T12:00:00Z`)) : "—";
  const items = [
    ["نوع قبض", utilityKinds[bill.kind]],
    ["صادرکننده", bill.issuer],
    ["شناسه قبض", bill.billId],
    ["شناسه پرداخت", bill.paymentId],
    ["اشتراک / پرونده", bill.subscriptionId],
    ["کنتور", bill.meterNumber],
    ["صدور", date(bill.issuedOn)],
    ["دریافت", date(bill.receivedOn)],
    ["مهلت پرداخت", date(bill.dueOn)],
    ["قرائت قبلی", date(bill.periodStart)],
    ["قرائت فعلی", date(bill.periodEnd)],
    ["عدد قبلی", bill.previousReading],
    ["عدد فعلی", bill.currentReading],
    [
      "مصرف",
      bill.consumption
        ? `${bill.consumption} ${bill.kind === "electricity" ? "کیلووات‌ساعت" : "مترمکعب"}`
        : "",
    ],
    [
      "بدهی قبلی",
      bill.previousDebtRial == null ? "" : formatToman(bill.previousDebtRial),
    ],
    [
      "هزینه دوره",
      bill.currentChargeRial == null ? "" : formatToman(bill.currentChargeRial),
    ],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs">
      {items
        .filter(([, v]) => v && v !== "—")
        .map(([l, v]) => (
          <div key={l} className="min-w-0">
            <dt className="text-muted-foreground">{l}</dt>
            <dd className="mt-2 break-words tabular-nums">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

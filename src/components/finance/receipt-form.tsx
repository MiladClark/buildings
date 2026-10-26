"use client";
import { Select } from "@/components/ui/select";

import { useRef, useState } from "react";
import { ActionForm } from "./forms";
import { MoneyInput } from "./money-input";
import { JalaliDateField } from "./calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatToman,
  tomanInputToRial,
  toPersianDigits as fa,
} from "@/lib/format/money";
import { isoDate } from "@/lib/format/jalali";
import { editReceipt } from "@/lib/actions/management";
import { recordPayment, requestPayment } from "@/lib/actions/building";
import type { CostShare } from "@/lib/billing/settlement-state";

export function ReceiptForm({
  units,
  shares,
  today,
  resident = false,
  initial,
  defaultUnitId,
  defaultPurpose,
  lockUnit = false,
  onSaved,
  standaloneCosts = [],
  defaultStandaloneId,
}: {
  units: { id: string; label: string }[];
  shares: CostShare[];
  today: string;
  resident?: boolean;
  defaultUnitId?: string;
  defaultPurpose?: { periodId: string; categoryId: string };
  lockUnit?: boolean;
  onSaved?: () => void;
  standaloneCosts?: { id: string; description: string }[];
  defaultStandaloneId?: string;
  initial?: {
    id: string;
    unitId: string;
    periodId: string | null;
    categoryId: string | null;
    amountRial: number;
    paidAt: string;
    method: string;
    note: string;
    standaloneExpenseId?: string | null;
    standaloneTitle?: string;
    kind?: "receipt" | "advance";
    applications: {
      unitId: string;
      periodId: string;
      categoryId: string | null;
      amountRial: number;
    }[];
  };
}) {
  const [unitId, setUnitId] = useState(
    initial?.unitId ??
      (units.some((u) => u.id === defaultUnitId)
        ? defaultUnitId!
        : resident
          ? (units[0]?.id ?? "")
          : ""),
  );
  const [purpose, setPurpose] = useState(
    initial?.standaloneExpenseId
      ? `standalone:${initial.standaloneExpenseId}`
      : defaultStandaloneId
        ? `standalone:${defaultStandaloneId}`
        : initial
          ? initial.categoryId
            ? JSON.stringify([initial.periodId, initial.categoryId])
            : "general"
          : defaultPurpose
            ? JSON.stringify([
                defaultPurpose.periodId,
                defaultPurpose.categoryId,
              ])
            : "",
  );
  const [amount, setAmount] = useState(initial?.amountRial ?? 0);
  const [kind, setKind] = useState<"receipt" | "advance">(
    initial?.kind ?? "receipt",
  );
  const separateOptions =
    initial?.standaloneExpenseId &&
    !standaloneCosts.some((c) => c.id === initial.standaloneExpenseId)
      ? [
          ...standaloneCosts,
          {
            id: initial.standaloneExpenseId,
            description: initial.standaloneTitle ?? "هزینه مستقل قبلی",
          },
        ]
      : standaloneCosts;
  const chosenStandalone = separateOptions.find(
    (c) => `standalone:${c.id}` === purpose,
  );
  const submission = useRef({ payload: "", key: "" });
  const adjustedShares = shares.map((s) => {
    const removed =
      initial?.applications
        .filter(
          (a) =>
            a.unitId === s.unitId &&
            a.periodId === s.periodId &&
            a.categoryId === s.categoryId,
        )
        .reduce((sum, a) => sum + a.amountRial, 0) ?? 0;
    return {
      ...s,
      paidRial: Math.max(0, s.paidRial - removed),
      balanceRial: Math.max(0, s.amountRial - s.paidRial + removed),
    };
  });
  const costs = adjustedShares.filter(
    (s) => s.unitId === unitId && s.categoryId && s.amountRial > 0,
  );
  const chosen = costs.find(
    (s) => JSON.stringify([s.periodId, s.categoryId]) === purpose,
  );
  const applied = Math.min(amount, chosen?.balanceRial ?? 0);
  return (
    <ActionForm
      className="form-grid"
      onSuccess={onSaved}
      success={
        resident
          ? "اعلام واریز برای تأیید مدیر ثبت شد."
          : initial
            ? "واریز اصلاح و مانده‌ها به‌روز شد."
            : "واریز ثبت و سهم هزینه به‌روز شد."
      }
      action={async (f) => {
        if (!purpose || (purpose !== "general" && !chosen && !chosenStandalone))
          throw new Error(
            "هزینه انتخاب‌شده تغییر کرده است؛ موضوع پرداخت را دوباره انتخاب کنید.",
          );
        const common = {
          periodId: chosen?.periodId,
          categoryId: chosen?.categoryId ?? undefined,
          amountRial: tomanInputToRial(f.get("amountToman")),
          note: String(f.get("note") || ""),
        };
        if (resident) await requestPayment(common);
        else {
          const data = {
            ...common,
            standaloneExpenseId: chosenStandalone?.id,
            kind: chosenStandalone ? kind : ("receipt" as const),
            unitId,
            method: String(f.get("method")) as
              "bank_transfer" | "cash" | "other",
            paidAt: String(f.get("paidAt")),
          };
          const payload = JSON.stringify(data);
          if (submission.current.payload !== payload)
            submission.current = { payload, key: crypto.randomUUID() };
          if (initial) await editReceipt(initial.id, data);
          else
            await recordPayment({
              ...data,
              receiptKey: submission.current.key,
            });
          submission.current = { payload: "", key: "" };
        }
      }}
    >
      {initial && (
        <p className="col-span-full rounded-lg bg-muted p-3 text-xs leading-7 text-muted-foreground">
          با تغییر مبلغ، واحد یا موضوع، تخصیص‌های همین واریز برگشت می‌خورند و
          مبلغ اصلاح‌شده دوباره بابت موضوع انتخابی محاسبه می‌شود. سایر واریزها
          حفظ می‌شوند.
        </p>
      )}
      {!resident && !lockUnit && (
        <div className="form-field">
          <label htmlFor="receipt-unit">واحد پرداخت‌کننده</label>
          <Select
            id="receipt-unit"
            value={unitId}
            onValueChange={(value) => {
              setUnitId(value);
              const source =
                initial?.standaloneExpenseId ?? defaultStandaloneId;
              setPurpose(source ? `standalone:${source}` : "");
            }}
            required
          >
            <option value="" disabled>
              واحد را انتخاب کنید
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                واحد {fa(u.label)}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className={`form-field ${resident ? "col-span-full" : ""}`}>
        <label htmlFor="receipt-purpose">بابت کدام هزینه؟</label>
        <Select
          id="receipt-purpose"
          value={purpose}
          onValueChange={(value) => setPurpose(value)}
          required
          disabled={
            !unitId || !!initial?.standaloneExpenseId || !!defaultStandaloneId
          }
        >
          <option value="" disabled>
            موضوع واریز را انتخاب کنید
          </option>
          <option value="general">واریز عمومی به حساب واحد</option>
          {!resident &&
            separateOptions.map((c) => (
              <option key={c.id} value={`standalone:${c.id}`}>
                {c.description} · هزینه مستقل
              </option>
            ))}
          {costs.map((s) => (
            <option
              key={JSON.stringify([s.periodId, s.categoryId])}
              value={JSON.stringify([s.periodId, s.categoryId])}
            >
              {s.title} · {s.periodTitle} ·{" "}
              {s.balanceRial === 0
                ? "تسویه‌شده"
                : `مانده ${formatToman(s.balanceRial)}`}
              {s.draft ? " (پیش‌پرداخت)" : ""}
            </option>
          ))}
        </Select>
      </div>
      {!resident && chosenStandalone && (
        <>
          <div className="form-field col-span-full">
            <label htmlFor="receipt-kind">نوع ثبت</label>
            <Select
              id="receipt-kind"
              value={kind}
              onValueChange={(v) => setKind(v as "receipt" | "advance")}
            >
              <option value="receipt">واریز به مدیر بابت این هزینه</option>
              <option value="advance">پرداخت مستقیم از جیب این واحد</option>
            </Select>
          </div>
          <p className="col-span-full rounded-lg bg-secondary p-3 text-xs leading-7 text-muted-foreground">
            {kind === "advance"
              ? "این مبلغ طلب واحد از ساختمان است، نه پول واریزشده به صندوق. مبلغی را بنویسید که واحد به فروشنده یا مجری داده است."
              : "مبلغی را بنویسید که از این واحد دریافت کرده‌اید؛ این ثبت، پرداخت به فروشنده محسوب نمی‌شود."}{" "}
            تا وقتی هزینه به دوره منتقل نشود، مبلغ برای همین هزینه محفوظ می‌ماند
            و شارژ دیگری را تسویه نمی‌کند. پس از انتقال، مازاد سهم به بستانکاری
            آزاد تبدیل می‌شود.
          </p>
        </>
      )}
      {chosen && (
        <div className="col-span-full rounded-xl border border-border bg-secondary/40 p-4 text-xs leading-7">
          <p className="font-medium">
            {chosen.title} · {chosen.periodTitle}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
            <span>سهم واحد: {formatToman(chosen.amountRial)}</span>
            <span>پرداخت قبلی: {formatToman(chosen.paidRial)}</span>
            <span>مانده: {formatToman(chosen.balanceRial)}</span>
          </div>
          {chosen.draft && (
            <p className="mt-2 text-muted-foreground">
              این دوره هنوز پیش‌نویس است؛ مبلغ بابت همین هزینه محفوظ می‌ماند.
              تغییر مبلغ هزینه یا نفرات ممکن است سهم را تغییر دهد.
            </p>
          )}
        </div>
      )}
      <div className="form-field">
        <label htmlFor="receipt-amount">
          {chosenStandalone && kind === "advance"
            ? "مبلغ پرداخت مستقیم (تومان)"
            : "مبلغ واریز (تومان)"}
        </label>
        <MoneyInput
          id="receipt-amount"
          name="amountToman"
          placeholder="مثلاً ۴۷۰٬۰۰۰"
          required
          defaultRial={initial?.amountRial}
          onChange={(e) => {
            try {
              setAmount(tomanInputToRial(e.target.value));
            } catch {
              setAmount(0);
            }
          }}
        />
      </div>
      {!resident && (
        <>
          <div className="form-field">
            <label htmlFor="receipt-method">روش پرداخت</label>
            <Select
              id="receipt-method"
              name="method"
              defaultValue={initial?.method ?? "bank_transfer"}
            >
              <option value="bank_transfer">واریز بانکی</option>
              <option value="cash">نقدی</option>
              <option value="other">سایر</option>
            </Select>
          </div>
          <JalaliDateField
            name="paidAt"
            label={
              chosenStandalone && kind === "advance"
                ? "تاریخ پرداخت مستقیم"
                : "تاریخ واریز"
            }
            defaultValue={
              initial?.paidAt ? isoDate(new Date(initial.paidAt)) : today
            }
            required
          />
        </>
      )}
      <div className="form-field col-span-full">
        <label htmlFor="receipt-note">شرح یا شماره پیگیری</label>
        <Input
          id="receipt-note"
          name="note"
          maxLength={2000}
          defaultValue={initial?.note}
          required={resident}
        />
      </div>
      {chosen && amount > 0 && (
        <div
          role="status"
          className="col-span-full rounded-xl bg-secondary p-4 text-xs leading-7"
        >
          <p>
            از این واریز بابت {chosen.title}:{" "}
            <strong>{formatToman(applied)}</strong>
          </p>
          <p>
            مانده این هزینه پس از ثبت:{" "}
            <strong>
              {formatToman(Math.max(0, chosen.balanceRial - amount))}
            </strong>
          </p>
          <p className="text-primary">
            اعتبار اضافه در حساب واحد:{" "}
            <strong>{formatToman(amount - applied)}</strong>
          </p>
          {resident && (
            <p className="text-muted-foreground">
              محاسبه نهایی پس از تأیید مدیر انجام می‌شود.
            </p>
          )}
        </div>
      )}
      {purpose === "general" && (
        <p className="col-span-full text-[11px] leading-6 text-muted-foreground">
          واریز عمومی ابتدا بدهی فیش‌های صادرشده را به‌ترتیب تسویه می‌کند؛ باقی
          مبلغ بستانکاری است. برای پرداخت فقط یک هزینه، موضوع آن را انتخاب کنید.
        </p>
      )}
      <Button type="submit" className="w-fit" disabled={!units.length}>
        {resident
          ? "ثبت درخواست تأیید"
          : initial
            ? "ذخیره اصلاح واریز"
            : chosenStandalone && kind === "advance"
              ? "ثبت پرداخت و طلب واحد"
              : "ثبت دریافت"}
      </Button>
    </ActionForm>
  );
}

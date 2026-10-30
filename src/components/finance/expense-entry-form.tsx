"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "./forms";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field-hint";
import { MoneyInput } from "./money-input";
import { JalaliDateField } from "./calendar";
import { tomanInputToRial } from "@/lib/format/money";
import { addExpenseLine } from "@/lib/actions/building";
import { saveStandaloneExpense } from "@/lib/actions/standalone-expenses";
import { BillCoverageField } from "./bill-coverage-field";

export function ExpenseEntryForm({
  categories,
  periods,
  today,
  ticket,
  independent = false,
  initial,
}: {
  categories: { id: string; name: string }[];
  periods: { id: string; title: string }[];
  today: string;
  independent?: boolean;
  ticket?: { id: string; title: string };
  initial?: {
    id: string;
    categoryId: string;
    amountRial: number;
    description: string;
    expenseDate: string;
    maintenanceTicketId?: string | null;
  };
}) {
  const [mode, setMode] = useState(
    initial || independent || !periods.length ? "independent" : "period",
  );
  const router = useRouter();
  return (
    <ActionForm
      className="form-grid"
      closeOnSuccess={mode !== "independent" || !!initial}
      action={async (f) => {
        const common = {
          categoryId: String(f.get("categoryId")),
          amountRial: tomanInputToRial(f.get("amountToman")),
          description: String(f.get("description") || ""),
          expenseDate: String(f.get("expenseDate")),
          maintenanceTicketId:
            ticket?.id ?? initial?.maintenanceTicketId ?? undefined,
        };
        if (mode === "independent") {
          const id = await saveStandaloneExpense(common, initial?.id);
          router.push(`/manager/expenses/independent/${id}`);
        } else
          await addExpenseLine({
            ...common,
            coverageMonths: f.get("coverageMonths")
              ? Number(f.get("coverageMonths"))
              : null,
            billingTreatment: String(f.get("billingTreatment") || "auto") as
              "auto" | "separate",
            periodId: String(f.get("periodId")),
          });
      }}
    >
      {!initial && (
        <div className="form-field col-span-full">
          <div className="flex items-center gap-1">
            <label htmlFor="expense-mode">محل ثبت هزینه</label>
            <FieldHint label="محل ثبت هزینه">
              مستقل: فقط در دفتر ثبت می‌شود. در دوره: در محاسبه سهم واحدها و فیش
              همان دوره قرار می‌گیرد.
            </FieldHint>
          </div>
          <Select id="expense-mode" value={mode} onValueChange={setMode}>
            <option value="independent">مستقل؛ فعلاً خارج از شارژ</option>
            {periods.length > 0 && (
              <option value="period">در شارژ یک دوره</option>
            )}
          </Select>
        </div>
      )}
      {mode === "period" ? (
        <div className="form-field col-span-full">
          <label htmlFor="expense-period">دوره مالی</label>
          <Select id="expense-period" name="periodId" required>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <p className="col-span-full rounded-lg bg-secondary p-3 text-xs leading-7 text-muted-foreground">
          فعلاً در شارژ و فیش واحدها نمی‌آید. بعد از ثبت می‌توانید واریزها و
          پرداخت مستقیم واحدها را وارد کنید و هر زمان خواستید به یک دوره باز
          انتقال دهید.
        </p>
      )}
      {ticket && (
        <p className="col-span-full text-xs text-muted-foreground">
          مرتبط با درخواست «{ticket.title}»
        </p>
      )}
      <div className="form-field">
        <label htmlFor="expense-cat">دسته هزینه</label>
        <Select
          id="expense-cat"
          name="categoryId"
          defaultValue={initial?.categoryId}
          required
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="form-field">
        <label htmlFor="expense-amount">مبلغ هزینه / برآورد خرید (تومان)</label>
        <MoneyInput
          id="expense-amount"
          name="amountToman"
          required
          defaultRial={initial?.amountRial}
          placeholder="مثلاً ۴٬۵۰۰٬۰۰۰"
        />
        <p className="text-xs text-muted-foreground leading-7">
          ثبت این مبلغ، پرداخت محسوب نمی‌شود و موجودی را کم نمی‌کند. مبلغ واقعی
          را بعداً با «ثبت پرداخت» تأیید کنید.
        </p>
      </div>
      <JalaliDateField
        name="expenseDate"
        label="تاریخ هزینه"
        required
        defaultValue={initial?.expenseDate ?? today}
      />
      <div className="form-field">
        <label htmlFor="expense-desc">شرح هزینه</label>
        <Input
          id="expense-desc"
          name="description"
          defaultValue={initial?.description ?? ticket?.title}
          required={mode === "independent"}
          maxLength={2000}
          placeholder="مثلاً نظافت راه‌پله و پارکینگ"
        />
      </div>
      {mode === "period" && <BillCoverageField />}
      {mode === "period" && (
        <div className="form-field col-span-full">
          <label htmlFor="expense-payment-source">روش تأمین هزینه</label>
          <Select
            id="expense-payment-source"
            name="billingTreatment"
            defaultValue="auto"
          >
            <option value="auto">از محل شارژ؛ آب جدا بر اساس نفرات</option>
            <option value="separate">
              دریافت جداگانه از واحدها (فوق‌العاده)
            </option>
          </Select>
          <p className="text-xs leading-6 text-muted-foreground">
            وقتی شارژ ماهانه تعیین شده باشد، هزینه معمول دوباره به بدهی واحد
            اضافه نمی‌شود.
          </p>
        </div>
      )}
      <Button type="submit" className="w-fit">
        {initial
          ? "ذخیره اصلاح هزینه"
          : mode === "independent"
            ? "ثبت هزینه مستقل"
            : "ثبت هزینه در دوره"}
      </Button>
    </ActionForm>
  );
}

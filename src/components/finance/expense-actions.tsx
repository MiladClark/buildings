"use client";
import { RowActions } from "@/components/ui/row-actions";
import { Select } from "@/components/ui/select";
import { BillCoverageField } from "./bill-coverage-field";

import { useState } from "react";
import { ActionForm, FormModal } from "./forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JalaliDateField } from "./calendar";
import { MoneyInput } from "./money-input";
import { isoDate } from "@/lib/format/jalali";
import { tomanInputToRial } from "@/lib/format/money";
import { editExpense, setRecordDeleted } from "@/lib/actions/management";
import { UtilityBillFields, UtilityBillDetails } from "./utility-bill-fields";
import {
  utilityBillFromForm,
  type UtilityBill,
} from "@/lib/billing/utility-bill";

export function ExpenseActions({
  expense,
  categories,
  tickets = [],
  standaloneId,
  links = [],
}: {
  expense: {
    billingTreatment?: "auto" | "separate";
    coverageMonths?: number | null;
    utilityBill?: UtilityBill | null;
    id: string;
    categoryId: string;
    amount: number;
    description: string;
    date: string;
    draft: boolean;
    maintenanceTicketId?: string | null;
  };
  categories: { id: string; name: string }[];
  tickets?: { id: string; title: string }[];
  standaloneId?: string;
  links?: { label: string; href: string }[];
}) {
  const [amount, setAmount] = useState(expense.amount);
  const [categoryId, setCategoryId] = useState(expense.categoryId);
  const [billingTreatment, setBillingTreatment] = useState(
    expense.billingTreatment ?? "auto",
  );
  const needsReopen =
    !expense.draft &&
    (amount !== expense.amount ||
      categoryId !== expense.categoryId ||
      billingTreatment !== (expense.billingTreatment ?? "auto"));
  if (standaloneId)
    return (
      <RowActions
        label="عملیات هزینه"
        items={[
          ...links,
          {
            label: "مدیریت هزینه مستقل",
            href: `/manager/expenses/independent/${standaloneId}`,
          },
        ]}
      />
    );
  return (
    <RowActions
      label="عملیات هزینه"
      items={[
        ...links,
        ...(expense.utilityBill
          ? [
              {
                label: "مشخصات قبض",
                dialog: (
                  <FormModal
                    title="مشخصات قبض"
                    description={expense.description}
                  >
                    <UtilityBillDetails bill={expense.utilityBill} />
                  </FormModal>
                ),
              },
            ]
          : []),
        {
          label: "ویرایش",
          dialog: (
            <FormModal
              title="ویرایش هزینه"
              description={
                expense.draft
                  ? "مبلغ یا شرح هزینه را اصلاح کنید؛ سهم پیش‌نویس و پیش‌پرداخت‌ها به‌روز می‌شود."
                  : "تغییر مبلغ یا دسته، دوره را برای اصلاح باز و فیش‌های فعلی را باطل می‌کند؛ واریزها حفظ می‌شوند. پس از بررسی سهم‌ها، فیش‌ها را دوباره صادر کنید."
              }
              trigger={
                <Button variant="outline" size="sm">
                  ویرایش
                </Button>
              }
            >
              <ActionForm
                className="form-grid"
                action={async (f) => {
                  await editExpense(expense.id, {
                    coverageMonths: f.get("coverageMonths")
                      ? Number(f.get("coverageMonths"))
                      : null,
                    billingTreatment: String(
                      f.get("billingTreatment") || "auto",
                    ) as "auto" | "separate",
                    categoryId: String(f.get("categoryId")),
                    maintenanceTicketId:
                      String(f.get("maintenanceTicketId") || "") || null,
                    amountRial: tomanInputToRial(f.get("amountToman")),
                    description: String(f.get("description") || ""),
                    expenseDate: String(f.get("expenseDate")),
                    utilityBill: utilityBillFromForm(f),
                  });
                }}
              >
                <div className="form-field">
                  <label htmlFor={`edit-cat-${expense.id}`}>دسته هزینه</label>
                  <Select
                    id={`edit-cat-${expense.id}`}
                    name="categoryId"
                    value={categoryId}
                    onValueChange={(value) => setCategoryId(value)}
                    required
                  >
                    {!categories.some((c) => c.id === expense.categoryId) && (
                      <option value={expense.categoryId}>
                        دسته فعلی (غیرفعال)
                      </option>
                    )}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="form-field">
                  <label htmlFor={`edit-amount-${expense.id}`}>
                    مبلغ (تومان)
                  </label>
                  <MoneyInput
                    id={`edit-amount-${expense.id}`}
                    name="amountToman"
                    onChange={(e) => {
                      try {
                        setAmount(tomanInputToRial(e.target.value));
                      } catch {
                        setAmount(NaN);
                      }
                    }}
                    defaultRial={expense.amount}
                    required
                  />
                </div>
                <JalaliDateField
                  name="expenseDate"
                  label="تاریخ هزینه"
                  defaultValue={isoDate(new Date(expense.date))}
                  required
                />
                <div className="form-field">
                  <label htmlFor={`edit-desc-${expense.id}`}>شرح هزینه</label>
                  <Input
                    id={`edit-desc-${expense.id}`}
                    name="description"
                    defaultValue={expense.description}
                    maxLength={2000}
                  />
                </div>
                <div className="form-field col-span-full">
                  <label htmlFor={`ticket-${expense.id}`}>
                    درخواست مرتبط (اختیاری)
                  </label>
                  <Select
                    id={`ticket-${expense.id}`}
                    name="maintenanceTicketId"
                    defaultValue={expense.maintenanceTicketId ?? ""}
                  >
                    <option value="">بدون ارتباط با درخواست</option>
                    {expense.maintenanceTicketId &&
                      !tickets.some(
                        (t) => t.id === expense.maintenanceTicketId,
                      ) && (
                        <option value={expense.maintenanceTicketId}>
                          درخواست قبلی (حذف‌شده)
                        </option>
                      )}
                    {tickets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <BillCoverageField months={expense.coverageMonths} />
                <UtilityBillFields initial={expense.utilityBill} />
                <div className="form-field col-span-full">
                  <label htmlFor={`billing-${expense.id}`}>
                    روش تأمین هزینه
                  </label>
                  <Select
                    id={`billing-${expense.id}`}
                    name="billingTreatment"
                    value={billingTreatment}
                    onValueChange={(value) =>
                      setBillingTreatment(value as "auto" | "separate")
                    }
                  >
                    <option value="auto">
                      از محل شارژ؛ آب جدا بر اساس نفرات
                    </option>
                    <option value="separate">
                      دریافت جداگانه از واحدها (فوق‌العاده)
                    </option>
                  </Select>
                </div>
                {needsReopen && (
                  <label className="col-span-full flex items-start gap-2 text-xs leading-7">
                    <input className="mt-2" type="checkbox" required />
                    بازشدن دوره و نیاز به صدور دوباره فیش‌ها را تأیید می‌کنم.
                  </label>
                )}
                <Button className="w-fit" type="submit">
                  ذخیره اصلاح هزینه
                </Button>
              </ActionForm>
            </FormModal>
          ),
        },
        {
          label: "حذف",
          action: () => setRecordDeleted("expense", expense.id, true),
          confirm: expense.draft
            ? "هزینه حذف شود؟ مبلغ پیش‌پرداخت آزادشده به بستانکاری برمی‌گردد و هزینه از سابقه و بازیابی قابل برگشت است."
            : "هزینه حذف و دوره برای اصلاح باز شود؟ فیش‌های فعلی باطل می‌شوند و واریزها حفظ می‌شوند. پس از بررسی سهم‌ها دوباره فیش صادر کنید. هزینه قابل بازیابی است.",
          danger: true,
        },
      ]}
    />
  );
}

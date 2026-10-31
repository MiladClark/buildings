"use client";
import { Select } from "@/components/ui/select";

import { useState } from "react";
import { DataGrid } from "@/components/finance/data-grid";
import { ExpenseActions, ExpenseScopeButton } from "./expense-actions";

import { formatJalaliDate } from "@/lib/format/jalali";
import type { UtilityBill } from "@/lib/billing/utility-bill";
type ExpenseRow = {
  utilityBill?: UtilityBill | null;
  coverageMonths?: number | null;
  billingTreatment?: "auto" | "separate";
  id: string;
  periodId: string;
  maintenanceTicketId: string | null;
  ticketTitle: string;
  category: string;
  categoryId: string;
  description: string;
  amount: number;
  date: string;
  method: string;
  period: string;
  draft: boolean;
  standaloneId?: string;
};
export function ExpenseList({
  rows,
  categoryOptions,
  tickets,
}: {
  rows: ExpenseRow[];
  categoryOptions: { id: string; name: string }[];
  tickets: { id: string; title: string }[];
}) {
  const [selectedCategory, setCategory] = useState("all");
  const [scope, setScope] = useState("all");
  const categories = [...new Set(rows.map((r) => r.category))];
  const category = categories.includes(selectedCategory)
    ? selectedCategory
    : "all";
  const filtered = rows
    .filter(
      (r) =>
        (category === "all" || r.category === category) &&
        (scope === "all" ||
          (scope === "independent" ? !r.periodId : Boolean(r.periodId))),
    )
    .map((r) => ({
      ...r,
      dateLabel: formatJalaliDate(new Date(r.date)),
      basis:
        r.method === "per_person"
          ? "بر اساس نفرات"
          : r.method === "fixed_per_unit"
            ? "مبلغ ثابت"
            : "بر اساس واحد",
    }));
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">همه هزینه‌ها</h2>
          <p className="panel-subtitle">
            مستقل یا داخل دوره؛ تغییر محل ثبت، پرداخت واقعی را حذف نمی‌کند.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label="محل ثبت هزینه"
            value={scope}
            onValueChange={setScope}
          >
            <option value="all">همه هزینه‌ها</option>
            <option value="independent">مستقل؛ خارج از دوره</option>
            <option value="period">داخل دوره شارژ</option>
          </Select>
          <Select
            aria-label="فیلتر دسته هزینه"
            value={category}
            onValueChange={(value) => setCategory(value)}
            className="text-xs"
          >
            <option value="all">تمام دسته‌ها</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
      </div>
      <DataGrid
        data={filtered}
        filename="building-expenses"
        searchPlaceholder="جست‌وجو در شرح هزینه یا دوره"
        mobile={{
          title: "description",
          subtitle: "category",
          amount: "amount",
          details: ["period", "dateLabel", "basis"],
        }}
        columns={[
          { key: "description", label: "شرح هزینه" },
          { key: "category", label: "دسته" },
          { key: "dateLabel", label: "تاریخ" },
          { key: "period", label: "محل ثبت" },
          { key: "basis", label: "روش تقسیم" },
          { key: "amount", label: "مبلغ", type: "money" },
        ]}
        renderAction={(r) => (
          <div className="flex flex-wrap items-center gap-2">
            {r.periodId && <ExpenseScopeButton id={r.id} draft={r.draft} />}
            <ExpenseActions
              links={[
                ...(r.periodId
                  ? [
                      {
                        label: "مشاهده دوره هزینه",
                        href: `/manager/periods/${r.periodId}`,
                      },
                    ]
                  : []),
                ...(r.maintenanceTicketId
                  ? [
                      {
                        label: "درخواست مرتبط",
                        href: `/manager/maintenance?ticket=${r.maintenanceTicketId}`,
                      },
                    ]
                  : []),
              ]}
              standaloneId={r.standaloneId}
              expense={r}
              categories={categoryOptions}
              tickets={tickets}
            />
          </div>
        )}
      />
    </section>
  );
}

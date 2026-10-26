"use client";
import { Select } from "@/components/ui/select";

import { useState } from "react";
import { DataGrid } from "@/components/finance/data-grid";
import { ExpenseActions } from "./expense-actions";

import { formatJalaliDate } from "@/lib/format/jalali";
type ExpenseRow = {
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
  const categories = [...new Set(rows.map((r) => r.category))];
  const category = categories.includes(selectedCategory)
    ? selectedCategory
    : "all";
  const filtered = rows
    .filter((r) => category === "all" || r.category === category)
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
          <h2 className="panel-title">دفتر هزینه‌ها</h2>
          <p className="panel-subtitle">
            هزینه نهایی‌شده هم قابل اصلاح است؛ دوره برای بررسی و صدور مجدد باز
            می‌شود
          </p>
        </div>
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
      <DataGrid
        data={filtered}
        filename="building-expenses"
        searchPlaceholder="جست‌وجو در شرح هزینه یا دوره"
        columns={[
          { key: "description", label: "شرح هزینه" },
          { key: "category", label: "دسته" },
          { key: "ticketTitle", label: "درخواست مرتبط" },
          { key: "dateLabel", label: "تاریخ" },
          { key: "period", label: "دوره" },
          { key: "basis", label: "روش تقسیم" },
          { key: "amount", label: "مبلغ", type: "money" },
        ]}
        renderAction={(r) => (
          <ExpenseActions
            links={[
              {
                label: "مشاهده دوره هزینه",
                href: `/manager/periods/${r.periodId}`,
              },
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
        )}
      />
    </section>
  );
}

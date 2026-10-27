"use client";
import { RowActions } from "@/components/ui/row-actions";
import { Eye } from "lucide-react";
import { DataGrid } from "@/components/finance/data-grid";
import { FormModal } from "@/components/finance/forms";
import { Button } from "@/components/ui/button";
import { formatToman } from "@/lib/format/money";
export function PeriodUnits({
  rows,
  finalized,
}: {
  rows: {
    id: string;
    label: string;
    name: string;
    total: number;
    balance: number;
    invoiceId: string | null;
    lines: { name: string; basis: string; amount: number }[];
  }[];
  finalized: boolean;
}) {
  const data = rows.map((r) => ({ ...r, unit: `واحد ${r.label}` }));
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">
            {finalized ? "فیش‌های صادرشده" : "پیش‌نمایش سهم واحدها"}
          </h2>
          <p className="panel-subtitle">
            {finalized
              ? "جزئیات محاسبه در زمان صدور ثبت و ثابت شده‌اند"
              : "قبل از صدور فیش، سهم هر واحد و مبنای تقسیم را بررسی کنید"}
          </p>
        </div>
      </div>
      <DataGrid
        data={data}
        filename="period-invoices"
        searchPlaceholder="جست‌وجوی فیش واحد"
        columns={[
          { key: "unit", label: "واحد" },
          { key: "name", label: "ساکن" },
          { key: "total", label: "سهم این دوره", type: "money" },
          { key: "balance", label: "مانده این دوره", type: "money" },
        ]}
        renderAction={(r) => (
          <RowActions
            items={[
              {
                label: `جزئیات محاسبه واحد ${r.label}`,
                dialog: (
                  <FormModal
                    title={`ریز محاسبه واحد ${r.label}`}
                    description="سهم همین دوره نمایش داده می‌شود. بدهی دوره‌های دیگر در مانده حساب واحد قابل مشاهده است."
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`جزئیات محاسبه واحد ${r.label}`}
                      >
                        <Eye size={17} />
                      </Button>
                    }
                  >
                    <div>
                      {r.lines.map((l, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 border-b border-border py-4"
                        >
                          <div>
                            <p className="text-sm font-medium">{l.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {l.basis}
                            </p>
                          </div>
                          <span className="text-xs">
                            {formatToman(l.amount)}
                          </span>
                        </div>
                      ))}
                      <p className="mt-6 flex justify-between text-sm font-bold">
                        <span>جمع سهم دوره</span>
                        {formatToman(r.total)}
                      </p>
                    </div>
                  </FormModal>
                ),
              },
              ...(r.invoiceId
                ? [
                    {
                      label: `دریافت PDF واحد ${r.label}`,
                      href: `/api/export/invoice/${r.invoiceId}/pdf`,
                    },
                    {
                      label: `دریافت تصویر واحد ${r.label}`,
                      href: `/api/export/invoice/${r.invoiceId}/png`,
                    },
                  ]
                : []),
            ]}
          />
        )}
      />
    </section>
  );
}

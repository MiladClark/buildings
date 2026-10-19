"use client";
import Link from "next/link";
import { FilePdf, Image as ImageIcon } from "@phosphor-icons/react";
import { DataGrid } from "@/components/finance/data-grid";
import { formatJalaliDate } from "@/lib/format/jalali";
export function InvoiceHistory({
  rows,
}: {
  rows: {
    id: string;
    period: string;
    total: number;
    paid: number;
    balance: number;
    due: string | null;
  }[];
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">تاریخچه فیش‌ها</h2>
        <p className="text-[10px] text-muted-foreground">تمام مبالغ به تومان</p>
      </div>
      <DataGrid
        data={rows.map((r) => ({
          ...r,
          dueLabel: r.due ? formatJalaliDate(new Date(r.due)) : "تعیین نشده",
          status: r.balance > 0 ? "بدهکار" : "تسویه‌شده",
        }))}
        columns={[
          { key: "period", label: "دوره" },
          { key: "total", label: "شارژ دوره", type: "money" },
          { key: "paid", label: "تسویه‌شده", type: "money" },
          { key: "balance", label: "مانده", type: "money" },
          { key: "dueLabel", label: "سررسید" },
          { key: "status", label: "وضعیت", type: "status" },
        ]}
        filename="my-invoices"
        emptyTitle="هنوز فیشی صادر نشده"
        emptyDescription="پس از نهایی‌شدن دوره توسط مدیر، فیش شما اینجا قرار می‌گیرد."
        renderAction={(r) => (
          <div className="flex gap-3">
            <Link
              aria-label={`دریافت PDF ${r.period}`}
              className="text-muted-foreground hover:text-primary"
              href={`/api/export/invoice/${r.id}/pdf`}
            >
              <FilePdf size={19} />
            </Link>
            <Link
              aria-label={`دریافت تصویر ${r.period}`}
              className="text-muted-foreground hover:text-primary"
              href={`/api/export/invoice/${r.id}/png`}
            >
              <ImageIcon size={19} />
            </Link>
          </div>
        )}
      />
    </section>
  );
}

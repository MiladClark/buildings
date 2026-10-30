import Link from "next/link";
import { CircleCheck, Receipt, Wallet } from "lucide-react";

import { InvoiceHistory } from "@/components/finance/invoice-history";
import { EmptyState } from "@/components/finance/forms";
import { Button } from "@/components/ui/button";
import { formatToman } from "@/lib/format/money";
import { getResidentInvoices } from "@/lib/queries/dashboard";
import { requireResident } from "@/lib/session";
export default async function ResidentInvoicesPage() {
  const { member } = await requireResident();
  if (!member.unitId)
    return (
      <EmptyState
        title="واحد شما متصل نشده"
        description="از مدیر ساختمان بخواهید حساب شما را به واحدتان متصل کند."
      />
    );
  const invoices = await getResidentInvoices(member.unitId);
  const outstanding = invoices.reduce(
    (sum, row) => sum + Math.max(0, row.invoice.balanceRial),
    0,
  );
  const latest = invoices[0];
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>فیش‌های من</h1>
          <p>سهم هر دوره، مانده پرداخت و نسخه قابل دریافت صورت‌حساب شما.</p>
        </div>
        {outstanding > 0 && (
          <Button asChild>
            <Link href="/resident/payments">اعلام واریز</Link>
          </Button>
        )}
      </div>
      <section
        aria-label="خلاصه فیش‌های من"
        className="grid max-sm:divide-y max-sm:divide-border max-sm:overflow-hidden max-sm:rounded-xl max-sm:border max-sm:border-border max-sm:bg-card sm:grid-cols-3 sm:gap-4"
      >
        {[
          {
            label: "مانده فیش‌ها",
            value: formatToman(outstanding),
            note: outstanding > 0 ? "نیازمند پرداخت" : "حساب تسویه است",
            icon: Wallet,
          },
          {
            label: "آخرین فیش",
            value: latest ? formatToman(latest.invoice.totalRial) : "—",
            note: latest?.period.title ?? "هنوز فیشی صادر نشده",
            icon: Receipt,
          },
          {
            label: "فیش‌های تسویه‌شده",
            value: invoices
              .filter((row) => row.invoice.balanceRial <= 0)
              .length.toLocaleString("fa-IR"),
            note: `از ${invoices.length.toLocaleString("fa-IR")} فیش صادرشده`,
            icon: CircleCheck,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 p-4 sm:block sm:rounded-[14px] sm:border sm:border-border sm:bg-card sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <item.icon
                size={20}
                className="hidden text-primary sm:block"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </div>
            <p className="min-w-0 break-words text-left text-base font-bold tabular-nums min-[360px]:text-lg sm:mt-4 sm:text-right sm:text-xl">
              {item.value}
            </p>
            <p className="col-span-2 text-[11px] leading-6 text-muted-foreground sm:mt-2 sm:text-[10px] sm:leading-normal">
              {item.note}
            </p>
          </div>
        ))}
      </section>
      <InvoiceHistory
        rows={invoices.map(({ invoice: i, period: p }) => ({
          id: i.id,
          period: p.title,
          total: i.totalRial,
          paid: i.paidRial,
          balance: i.balanceRial,
          due: p.dueDate?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

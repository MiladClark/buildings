import Link from "next/link";
import { CheckCircle, Receipt, Wallet } from "@phosphor-icons/react/dist/ssr";

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
      <div className="grid gap-4 sm:grid-cols-3">
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
            icon: CheckCircle,
          },
        ].map((item) => (
          <div key={item.label} className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <item.icon size={20} className="text-primary" weight="duotone" />
            </div>
            <p className="mt-4 text-xl font-bold">{item.value}</p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {item.note}
            </p>
          </div>
        ))}
      </div>
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

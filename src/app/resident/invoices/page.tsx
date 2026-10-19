import { InvoiceHistory } from "@/components/finance/invoice-history";
import { EmptyState } from "@/components/finance/forms";
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
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>فیش‌های من</h1>
          <p>سهم هر دوره، مانده پرداخت و نسخه قابل دریافت صورت‌حساب شما.</p>
        </div>
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

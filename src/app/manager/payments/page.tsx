import { LinkedFormModal as FormModal } from "@/components/finance/linked-modal";
import { PaymentHistory, PaymentRequests } from "@/components/finance/payments";
import { ReceiptForm } from "@/components/finance/receipt-form";
import { UnitAccounts } from "@/components/finance/unit-accounts";
import { invoiceRecipient } from "@/lib/export/invoice-recipient";
import { getFinanceData } from "@/lib/queries/finance";
import { requireManager } from "@/lib/session";
import { isoDate } from "@/lib/format/jalali";
import { formatToman } from "@/lib/format/money";
import { toPersianDigits as fa } from "@/lib/format/money";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    new?: string;
    unit?: string;
    period?: string;
    category?: string;
    receipt?: string;
  }>;
}) {
  const query = await searchParams;
  const { member } = await requireManager();
  const data = await getFinanceData(member.buildingId);
  const shares = [...data.settlement.shares].sort(
    (a, b) =>
      data.periods.findIndex((p) => p.id === a.periodId) -
      data.periods.findIndex((p) => p.id === b.periodId),
  );
  const accounts = data.settlement.accounts.map((a) => ({
    ...a,
    label: `واحد ${data.units.find((u) => u.id === a.unitId)?.label}`,
    state:
      a.balanceRial < 0
        ? "بستانکار"
        : a.balanceRial > 0
          ? "بدهکار"
          : a.debtRial > 0
            ? "نیاز به تخصیص اعتبار"
            : "تسویه‌شده",
  }));
  const receipts = data.payments.map(({ payment: p, unit: u }) => {
    const applied = data.applications
      .filter((a) => a.paymentId === p.id)
      .reduce((s, a) => s + a.amountRial, 0);
    return {
      id: p.id,
      unitId: p.unitId,
      periodId: p.periodId,
      categoryId: p.categoryId,
      applications: data.applications.filter((a) => a.paymentId === p.id),
      unit: `واحد ${u.label}`,
      name: invoiceRecipient(u).name || "نام ثبت نشده",
      amount: p.amountRial,
      date: p.paidAt.toISOString(),
      method: p.method,
      note: p.note || "",
      purpose: p.categoryId
        ? `${data.categories.find((c) => c.id === p.categoryId)?.name ?? "هزینه"} · ${data.periods.find((r) => r.id === p.periodId)?.title ?? "دوره حذف‌شده"}`
        : "واریز عمومی",
      applied: p.allocationTracked ? formatToman(applied) : "طبق تسویه قبلی",
      credit: p.allocationTracked
        ? formatToman(p.amountRial - applied)
        : "در حساب واحد",
    };
  });
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>دریافت‌ها و پرداخت‌ها</h1>
          <p>
            ثبت و اصلاح واریزها با مدیر است؛ سهم هر هزینه و مانده حساب واحدها از
            دریافت‌های ثبت‌شده محاسبه می‌شود.
          </p>
        </div>
        <FormModal
          key={[query.new, query.unit, query.period, query.category].join(":")}
          initialOpen={query.new === "1"}
          title="ثبت دریافت جدید"
          description="موضوع هزینه را انتخاب کنید؛ مبلغ فقط بابت همان هزینه مصرف می‌شود و اضافه آن اعتبار واحد می‌ماند."
        >
          <ReceiptForm
            defaultUnitId={query.unit}
            defaultPurpose={
              query.period && query.category
                ? { periodId: query.period, categoryId: query.category }
                : undefined
            }
            units={data.units
              .filter((u) => !u.deletedAt)
              .map((u) => ({ id: u.id, label: u.label }))}
            shares={shares}
            today={isoDate(new Date())}
          />
        </FormModal>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "کل دریافت‌های ثبت‌شده",
            value: data.payments.reduce((s, p) => s + p.payment.amountRial, 0),
          },
          {
            label: "بستانکاری قابل استفاده",
            value: accounts.reduce((s, a) => s + a.creditRial, 0),
          },
          {
            label: "پیش‌پرداخت هزینه‌های پیش‌نویس",
            value: accounts.reduce((s, a) => s + a.reservedRial, 0),
          },
        ].map((s) => (
          <div className="panel p-5" key={s.label}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-3 text-2xl font-bold text-primary">
              {formatToman(s.value)}
            </p>
          </div>
        ))}
      </div>
      <UnitAccounts
        shares={shares}
        accounts={accounts}
        receipts={receipts}
        today={isoDate(new Date())}
        units={data.units.map((u) => ({
          id: u.id,
          label: u.label,
          name: invoiceRecipient(u).name || "نام ثبت نشده",
          floor: u.floor,
          deleted: !!u.deletedAt,
          occupancy: u.temporarilyAbsent
            ? "غایب موقت"
            : u.status === "empty"
              ? "واحد خالی"
              : u.status === "owner_occupied"
                ? "سکونت مالک"
                : "مسکونی",
        }))}
      />
      <details open={!!query.receipt} className="group">
        <summary className="flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span>دفتر کل دریافت‌ها</span>
          <span className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
            {fa(String(receipts.length))} واریز · مشاهده و اصلاح همه واحدها
            <CaretDown
              size={17}
              className="transition-transform group-open:rotate-180"
            />
          </span>
        </summary>
        <div className="mt-4">
          <PaymentHistory
            key={query.receipt ?? "history"}
            focusReceiptId={query.receipt}
            units={data.units.map((u) => ({
              id: u.id,
              label: u.deletedAt ? `${u.label} (حذف‌شده)` : u.label,
            }))}
            shares={shares}
            rows={receipts}
          />
        </div>
      </details>
      <PaymentRequests
        requests={data.requests.map(
          ({ request: r, unit: u, confirmedAmountRial }) => ({
            id: r.id,
            unit: `واحد ${u.label}`,
            amount: r.amountRial,
            confirmed:
              confirmedAmountRial == null
                ? "—"
                : formatToman(confirmedAmountRial),
            note: r.note,
            date: r.createdAt.toISOString(),
            status: r.status,
            purpose: r.categoryId
              ? `${data.categories.find((c) => c.id === r.categoryId)?.name ?? "هزینه"} · ${data.periods.find((p) => p.id === r.periodId)?.title ?? "دوره حذف‌شده"}`
              : "واریز عمومی",
          }),
        )}
      />
    </div>
  );
}

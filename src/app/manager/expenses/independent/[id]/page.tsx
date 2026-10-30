import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/finance/forms";
import { ExpenseEntryForm } from "@/components/finance/expense-entry-form";
import { StandaloneCostActions } from "@/components/finance/standalone-expenses";
import { ReceiptForm } from "@/components/finance/receipt-form";
import { PaymentHistory } from "@/components/finance/payments";
import { getFinanceData } from "@/lib/queries/finance";
import { requireManager } from "@/lib/session";
import { formatToman } from "@/lib/format/money";
import { formatJalaliDate, isoDate } from "@/lib/format/jalali";
import { invoiceRecipient } from "@/lib/export/invoice-recipient";
import { TreasurySummary, TreasuryLedger } from "@/components/finance/treasury";

export default async function IndependentExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { member } = await requireManager();
  const { id } = await params;
  const data = await getFinanceData(member.buildingId);
  const cost = data.standaloneExpenses.find((c) => c.id === id);
  if (!cost) notFound();
  const linked = data.expenses.find(
    (e) => e.expense.id === cost.linkedExpenseId,
  )?.expense;
  const period = data.periods.find((p) => p.id === linked?.periodId);
  const rows = data.payments.filter(
    ({ payment: p }) => p.standaloneExpenseId === id,
  );
  const received = rows
    .filter(({ payment: p }) => p.kind === "receipt")
    .reduce((s, r) => s + r.payment.amountRial, 0);
  const advances = rows
    .filter(({ payment: p }) => p.kind === "advance")
    .reduce((s, r) => s + r.payment.amountRial, 0);
  const units = data.units.map((u) => ({ id: u.id, label: u.label }));
  const today = isoDate(new Date());
  return (
    <div className="space-y-6">
      <Link
        href="/manager/expenses#independent-costs"
        className="text-xs text-muted-foreground"
      >
        بازگشت به دفتر هزینه‌ها
      </Link>
      <div className="page-heading">
        <div>
          <h1>{cost.description}</h1>
          <p>
            {data.categories.find((c) => c.id === cost.categoryId)?.name} ·{" "}
            {formatJalaliDate(cost.expenseDate)} ·{" "}
            {cost.deletedAt
              ? "حذف‌شده"
              : period
                ? `در شارژ «${period.title}»`
                : "مستقل؛ خارج از شارژ"}
          </p>
        </div>
        {!cost.deletedAt && !cost.linkedExpenseId && (
          <FormModal
            title="ویرایش هزینه مستقل"
            description="مبلغ و مشخصات را اصلاح کنید؛ ثبت‌های پرداخت حفظ می‌شوند."
            trigger={<Button variant="outline">ویرایش مشخصات</Button>}
          >
            <ExpenseEntryForm
              initial={{ ...cost, expenseDate: isoDate(cost.expenseDate) }}
              today={today}
              periods={[]}
              categories={data.categories
                .filter(
                  (c) =>
                    (c.active || c.id === cost.categoryId) &&
                    c.allocationMethod !== "excluded",
                )
                .map((c) => ({ id: c.id, name: c.name }))}
            />
          </FormModal>
        )}
      </div>
      <TreasurySummary treasury={data.treasury} />
      <TreasuryLedger
        treasury={data.treasury}
        today={today}
        standaloneId={id}
        history={data.disbursements.map((d) => ({
          ...d,
          paidAt: d.paidAt.toISOString(),
          createdAt: d.createdAt.toISOString(),
          cancelledAt: d.cancelledAt?.toISOString() ?? null,
        }))}
      />
      <dl className="panel grid sm:grid-cols-3">
        {[
          ["مبلغ ثبت‌شده / برآورد", cost.amountRial],
          ["واریز به مدیر", received],
          ["پرداخت مستقیم از جیب واحدها", advances],
        ].map(([label, amount], index) => (
          <div
            key={label}
            className={
              index > 0
                ? "border-t border-border p-5 sm:border-s sm:border-t-0"
                : "p-5"
            }
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-3 text-xl font-semibold tabular-nums">
              {formatToman(Number(amount))}
            </dd>
          </div>
        ))}
      </dl>
      <section className="panel p-5 space-y-4">
        <h2 className="panel-title">وضعیت شارژ و حساب واحدها</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          {cost.linkedExpenseId
            ? "این هزینه وارد دوره شده است. پرداخت‌های قبلی بابت سهم همان واحد از این دسته هزینه محاسبه شده‌اند؛ اضافه آن در بستانکاری آزاد قرار دارد."
            : "این هزینه در هیچ فیش شارژی نیست. واریز به مدیر و پرداخت از جیب واحدها جدا ثبت می‌شوند؛ مبلغ هر واحد تا زمان انتقال هزینه محفوظ می‌ماند و در تسویه شارژهای دیگر مصرف نمی‌شود."}
        </p>
        <p className="text-xs leading-7 text-muted-foreground">
          پرداخت از جیب واحد، طلب همان واحد از ساختمان است و در درآمد نقدی صندوق
          حساب نمی‌شود. مبلغ واریز همسایه‌ها را دوباره به‌عنوان پرداخت مستقیم
          وارد نکنید.
        </p>
        {period && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/manager/periods/${period.id}`}>
              مشاهده سهم‌ها و فیش‌های دوره
            </Link>
          </Button>
        )}
        {cost.maintenanceTicketId && (
          <Button asChild variant="ghost" size="sm">
            <Link
              href={`/manager/maintenance?ticket=${cost.maintenanceTicketId}`}
            >
              درخواست مرتبط
            </Link>
          </Button>
        )}
        <StandaloneCostActions
          id={id}
          deleted={!!cost.deletedAt}
          linked={!!cost.linkedExpenseId}
          periods={data.periods
            .filter((p) => p.status === "draft")
            .map((p) => ({ id: p.id, title: p.title }))}
        />
      </section>
      {!cost.deletedAt && (
        <div className="flex flex-wrap justify-between gap-4 items-center">
          <div>
            <h2 className="text-base font-semibold">
              ثبت‌های مربوط به این هزینه
            </h2>
            <p className="text-xs text-muted-foreground mt-2">
              هر پرداخت با نام واحد، تاریخ و نوع ثبت قابل پیگیری و اصلاح است.
            </p>
          </div>
          <FormModal
            title="ثبت واریز یا پرداخت مستقیم"
            description="واحد و نوع ثبت را مشخص کنید؛ فقط مبلغ واقعی پرداخت‌شده را وارد کنید."
          >
            <ReceiptForm
              units={units.filter(
                (u) => !data.units.find((r) => r.id === u.id)?.deletedAt,
              )}
              shares={data.settlement.shares}
              today={today}
              standaloneCosts={[{ id, description: cost.description }]}
              defaultStandaloneId={id}
            />
          </FormModal>
        </div>
      )}
      <PaymentHistory
        units={units}
        shares={data.settlement.shares}
        rows={rows.map(({ payment: p, unit: u }) => {
          const applications = data.applications.filter(
            (a) => a.paymentId === p.id,
          );
          const applied = applications.reduce((s, a) => s + a.amountRial, 0);
          return {
            id: p.id,
            unitId: p.unitId,
            periodId: p.periodId,
            categoryId: p.categoryId,
            standaloneExpenseId: id,
            standaloneTitle: cost.description,
            kind: p.kind,
            applications,
            unit: `واحد ${u.label}`,
            name: invoiceRecipient(u).name || "نام ثبت نشده",
            amount: p.amountRial,
            date: p.paidAt.toISOString(),
            method: p.method,
            note: p.note ?? "",
            purpose:
              p.kind === "advance"
                ? "پرداخت مستقیم · طلب واحد"
                : "واریز به مدیر",
            applied: formatToman(applied),
            credit: cost.linkedExpenseId
              ? formatToman(p.amountRial - applied)
              : `محفوظ: ${formatToman(p.amountRial)}`,
          };
        })}
      />
    </div>
  );
}

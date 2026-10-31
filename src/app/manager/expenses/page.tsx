import { ExpenseList } from "@/components/finance/expense-list";
import { ExpenseEntryForm } from "@/components/finance/expense-entry-form";
import { StandaloneExpenses } from "@/components/finance/standalone-expenses";
import { LinkedFormModal as FormModal } from "@/components/finance/linked-modal";
import { getFinanceData } from "@/lib/queries/finance";
import { requireManager } from "@/lib/session";
import { isoDate, formatJalaliDate } from "@/lib/format/jalali";
import { formatTomanNumber } from "@/lib/format/money";
import Link from "next/link";
import { TreasurySummary, TreasuryLedger } from "@/components/finance/treasury";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    new?: string;
    ticket?: string;
    mode?: string;
    view?: string;
  }>;
}) {
  const { member } = await requireManager();
  const data = await getFinanceData(member.buildingId);
  const query = await searchParams;
  const view = ["payments", "archive"].includes(query.view ?? "")
    ? query.view
    : "costs";
  const ticket = data.maintenance.find(
    (t) => t.id === query.ticket && !t.deletedAt,
  );
  const drafts = data.periods.filter((p) => p.status === "draft");
  const separate = data.standaloneExpenses.filter(
    (c) => !c.deletedAt && !c.linkedExpenseId,
  );
  const categories = data.categories
    .filter((c) => c.active && c.allocationMethod !== "excluded")
    .map((c) => ({ id: c.id, name: c.name }));
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>هزینه‌های ساختمان</h1>
          <p>
            اول هزینه یا برآورد خرید را ثبت کنید؛ پس از پرداخت واقعی، مبلغ را از
            حساب کسر کنید.
          </p>
        </div>
        <FormModal
          key={[query.new, query.ticket, query.mode].join(":")}
          title="ثبت هزینه جدید"
          initialOpen={query.new === "1"}
          description="مبلغ کل هزینه را به تومان وارد کنید؛ برای ثبت مستقل، داشتن دوره مالی لازم نیست."
        >
          <ExpenseEntryForm
            categories={categories}
            periods={drafts}
            today={isoDate(new Date())}
            ticket={ticket ? { id: ticket.id, title: ticket.title } : undefined}
            independent={query.mode === "independent"}
          />
        </FormModal>
      </div>
      <TreasurySummary treasury={data.treasury} />
      <nav aria-label="بخش‌های هزینه‌ها" className="workspace-tabs">
        {[
          ["costs", "فهرست هزینه‌ها"],
          ["payments", "پرداخت از حساب"],
          ["archive", "بایگانی و بازیابی"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/manager/expenses?view=${key}`}
            aria-current={view === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {view === "payments" && (
        <TreasuryLedger
          treasury={data.treasury}
          today={isoDate(new Date())}
          history={data.disbursements.map((d) => ({
            ...d,
            paidAt: d.paidAt.toISOString(),
            createdAt: d.createdAt.toISOString(),
            cancelledAt: d.cancelledAt?.toISOString() ?? null,
          }))}
        />
      )}
      {view === "costs" && (
        <dl className="cost-totals grid grid-cols-3">
          {[
            [
              "کل هزینه‌های فعال",
              data.expenses.reduce((s, r) => s + r.expense.amountRial, 0) +
                separate.reduce((s, c) => s + c.amountRial, 0),
            ],
            [
              "هزینه مستقل؛ خارج از شارژ",
              separate.reduce((s, c) => s + c.amountRial, 0),
            ],
            [
              "هزینه‌های داخل دوره‌ها",
              data.expenses.reduce((s, r) => s + r.expense.amountRial, 0),
            ],
          ].map(([label, amount], index) => (
            <div
              className={index > 0 ? "border-s border-border p-5" : "p-5"}
              key={label}
            >
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-3 text-xl font-semibold tabular-nums">
                {formatTomanNumber(Number(amount))}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  تومان
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {view === "archive" && (
        <StandaloneExpenses
          initialFilter="deleted"
          rows={data.standaloneExpenses.map((c) => ({
            id: c.id,
            description: c.description,
            category:
              data.categories.find((cat) => cat.id === c.categoryId)?.name ??
              "—",
            date: formatJalaliDate(c.expenseDate),
            amount: c.amountRial,
            receipts: data.payments
              .filter(
                ({ payment: p }) =>
                  p.standaloneExpenseId === c.id && p.kind === "receipt",
              )
              .reduce((s, r) => s + r.payment.amountRial, 0),
            advances: data.payments
              .filter(
                ({ payment: p }) =>
                  p.standaloneExpenseId === c.id && p.kind === "advance",
              )
              .reduce((s, r) => s + r.payment.amountRial, 0),
            state: c.linkedExpenseId
              ? (data.periods.find(
                  (p) =>
                    p.id ===
                    data.expenses.find(
                      (e) => e.expense.id === c.linkedExpenseId,
                    )?.expense.periodId,
                )?.title ?? "در دوره")
              : "مستقل",
            deleted: !!c.deletedAt,
          }))}
        />
      )}
      {view === "costs" && (
        <ExpenseList
          tickets={data.maintenance
            .filter((t) => !t.deletedAt)
            .map((t) => ({ id: t.id, title: t.title }))}
          categoryOptions={categories}
          rows={[
            ...data.expenses.map(({ expense: e, category: c }) => ({
              billingTreatment: e.billingTreatment,
              coverageMonths: e.coverageMonths,
              utilityBill: e.utilityBill,
              id: e.id,
              maintenanceTicketId: e.maintenanceTicketId,
              ticketTitle:
                data.maintenance.find((t) => t.id === e.maintenanceTicketId)
                  ?.title ?? "—",
              periodId: e.periodId,
              category: c.name,
              categoryId: c.id,
              description: e.description || c.name,
              amount: e.amountRial,
              date: e.expenseDate.toISOString(),
              method: c.allocationMethod,
              period:
                data.periods.find((p) => p.id === e.periodId)?.title || "",
              draft:
                data.periods.find((p) => p.id === e.periodId)?.status ===
                "draft",
              standaloneId: data.standaloneExpenses.find(
                (cost) => cost.linkedExpenseId === e.id,
              )?.id,
            })),
            ...separate.map((c) => ({
              id: c.id,
              standaloneId: c.id,
              periodId: "",
              categoryId: c.categoryId,
              category:
                data.categories.find((cat) => cat.id === c.categoryId)?.name ??
                "—",
              description: c.description,
              amount: c.amountRial,
              date: c.expenseDate.toISOString(),
              method:
                data.categories.find((cat) => cat.id === c.categoryId)
                  ?.allocationMethod ?? "per_unit",
              period: "مستقل؛ خارج از دوره",
              draft: true,
              maintenanceTicketId: c.maintenanceTicketId,
              ticketTitle:
                data.maintenance.find((t) => t.id === c.maintenanceTicketId)
                  ?.title ?? "—",
              utilityBill: c.utilityBill,
            })),
          ].sort((a, b) => b.date.localeCompare(a.date))}
        />
      )}
    </div>
  );
}

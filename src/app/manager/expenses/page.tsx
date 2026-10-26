import { ExpenseList } from "@/components/finance/expense-list";
import { ExpenseEntryForm } from "@/components/finance/expense-entry-form";
import { StandaloneExpenses } from "@/components/finance/standalone-expenses";
import { LinkedFormModal as FormModal } from "@/components/finance/linked-modal";
import { getFinanceData } from "@/lib/queries/finance";
import { requireManager } from "@/lib/session";
import { isoDate, formatJalaliDate } from "@/lib/format/jalali";
import { formatToman } from "@/lib/format/money";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; ticket?: string; mode?: string }>;
}) {
  const { member } = await requireManager();
  const data = await getFinanceData(member.buildingId);
  const query = await searchParams;
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
            هزینه را مستقل نگه دارید یا در شارژ یک دوره ثبت کنید؛ انتخاب با
            شماست.
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
      {/* Three equal columns and two 1px rules fill the ledger width. */}
      <dl className="panel grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
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
        ].map(([label, amount]) => (
          <div className="p-5" key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-3 text-xl font-semibold tabular-nums">
              {formatToman(Number(amount))}
            </dd>
          </div>
        ))}
      </dl>
      <StandaloneExpenses
        rows={data.standaloneExpenses.map((c) => ({
          id: c.id,
          description: c.description,
          category:
            data.categories.find((cat) => cat.id === c.categoryId)?.name ?? "—",
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
                  data.expenses.find((e) => e.expense.id === c.linkedExpenseId)
                    ?.expense.periodId,
              )?.title ?? "در دوره")
            : "مستقل",
          deleted: !!c.deletedAt,
        }))}
      />
      <ExpenseList
        tickets={data.maintenance
          .filter((t) => !t.deletedAt)
          .map((t) => ({ id: t.id, title: t.title }))}
        categoryOptions={categories}
        rows={data.expenses.map(({ expense: e, category: c }) => ({
          billingTreatment: e.billingTreatment,
          coverageMonths: e.coverageMonths,
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
          period: data.periods.find((p) => p.id === e.periodId)?.title || "",
          draft:
            data.periods.find((p) => p.id === e.periodId)?.status === "draft",
          standaloneId: data.standaloneExpenses.find(
            (cost) => cost.linkedExpenseId === e.id,
          )?.id,
        }))}
      />
    </div>
  );
}

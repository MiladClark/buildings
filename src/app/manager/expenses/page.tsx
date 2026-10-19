import { Select } from "@/components/ui/select";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { ExpenseList } from "@/components/finance/expense-list";
import { ActionForm } from "@/components/finance/forms";
import { LinkedFormModal as FormModal } from "@/components/finance/linked-modal";
import { JalaliDateField } from "@/components/finance/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/finance/money-input";
import { addExpenseLine } from "@/lib/actions/building";
import { getFinanceData } from "@/lib/queries/finance";
import { requireManager } from "@/lib/session";
import { isoDate } from "@/lib/format/jalali";
import { formatToman, tomanInputToRial } from "@/lib/format/money";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; ticket?: string }>;
}) {
  const { member } = await requireManager();
  const data = await getFinanceData(member.buildingId);
  const query = await searchParams;
  const ticket = data.maintenance.find(
    (t) => t.id === query.ticket && !t.deletedAt,
  );
  const drafts = data.periods.filter((p) => p.status === "draft");
  async function save(f: FormData) {
    "use server";
    await addExpenseLine({
      periodId: String(f.get("periodId")),
      maintenanceTicketId:
        String(f.get("maintenanceTicketId") || "") || undefined,
      categoryId: String(f.get("categoryId")),
      amountRial: tomanInputToRial(f.get("amountToman")),
      description: String(f.get("description") || ""),
      expenseDate: String(f.get("expenseDate")),
    });
  }
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>هزینه‌های ساختمان</h1>
          <p>قبض‌ها، نظافت، تعمیرات و خرید تجهیزات؛ هر هزینه در جای خودش.</p>
        </div>
        {drafts.length ? (
          <FormModal
            key={[query.new, query.ticket].join(":")}
            title="ثبت هزینه جدید"
            initialOpen={query.new === "1"}
            description="هزینه را در یک دوره باز ثبت کنید. مبلغ اصلی قبض را بدون اعمال تورم وارد کنید."
          >
            <ActionForm action={save} className="form-grid">
              {ticket && (
                <>
                  <input
                    type="hidden"
                    name="maintenanceTicketId"
                    value={ticket.id}
                  />
                  <p className="col-span-full rounded-lg bg-secondary p-3 text-xs leading-7">
                    هزینه مرتبط با «{ticket.title}» ثبت می‌شود و در جزئیات همان
                    درخواست هم دیده خواهد شد.
                  </p>
                </>
              )}
              <div className="form-field col-span-full">
                <label htmlFor="expense-period">دوره مالی</label>
                <Select id="expense-period" name="periodId" required>
                  {drafts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-field">
                <label htmlFor="expense-cat">دسته هزینه</label>
                <Select id="expense-cat" name="categoryId" required>
                  {data.categories
                    .filter(
                      (c) => c.active && c.allocationMethod !== "excluded",
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="form-field">
                <label htmlFor="expense-amount">مبلغ (تومان)</label>
                <MoneyInput
                  id="expense-amount"
                  name="amountToman"
                  required
                  placeholder="مثلاً ۴٬۵۰۰٬۰۰۰"
                />
              </div>
              <JalaliDateField
                name="expenseDate"
                label="تاریخ هزینه"
                defaultValue={isoDate(new Date())}
                required
              />
              <div className="form-field">
                <label htmlFor="expense-desc">شرح هزینه</label>
                <Input
                  id="expense-desc"
                  name="description"
                  defaultValue={ticket?.title}
                  placeholder="مثلاً سرویس دوره‌ای آسانسور"
                />
              </div>
              <Button type="submit" className="w-fit">
                ثبت هزینه
              </Button>
            </ActionForm>
          </FormModal>
        ) : (
          <Button asChild>
            <Link href="/manager/periods">
              <Plus size={17} />
              ایجاد دوره برای ثبت هزینه
            </Link>
          </Button>
        )}
      </div>
      <section className="rounded-xl border border-border bg-secondary/40 p-5 text-xs leading-7">
        <h2 className="font-semibold">هزینه نظافت را اینجا ثبت کنید</h2>
        <p className="mt-2 text-muted-foreground">
          «ثبت هزینه جدید» ← انتخاب دوره مالی ← دسته «نظافت» ← مبلغ کل به تومان.
          مثلاً برای نظافت ۴٬۵۰۰٬۰۰۰ تومانی، عدد ۴٬۵۰۰٬۰۰۰ را وارد کنید؛ مبلغ کل
          ساختمان، نه سهم یک واحد. پس از بررسی سهم واحدها در دوره، فیش‌ها را
          صادر کنید.
        </p>
        <p className="mt-2 text-muted-foreground">
          اگر هنوز دوره باز ندارید، از «شارژ و صورت‌حساب‌ها» یک دوره بسازید.
          واریزی هر همسایه را جداگانه در{" "}
          <Link
            className="font-medium text-primary underline underline-offset-4"
            href="/manager/payments"
          >
            دریافت‌ها و پرداخت‌ها
          </Link>{" "}
          ثبت کنید.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-5">
          <p className="text-xs text-muted-foreground">کل هزینه‌های ثبت‌شده</p>
          <p className="mt-3 text-2xl font-bold">
            {formatToman(
              data.expenses.reduce((s, r) => s + r.expense.amountRial, 0),
            )}
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-xs text-muted-foreground">تقسیم بر اساس نفرات</p>
          <p className="mt-3 text-sm leading-7">
            آب ساختمان؛ متناسب با جمعیت واحدها
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-xs text-muted-foreground">تقسیم بر اساس واحدها</p>
          <p className="mt-3 text-sm leading-7">
            برق مشترک، آسانسور و دیگر هزینه‌ها
          </p>
        </div>
      </div>
      <ExpenseList
        tickets={data.maintenance
          .filter((t) => !t.deletedAt)
          .map((t) => ({ id: t.id, title: t.title }))}
        categoryOptions={data.categories
          .filter((c) => c.active && c.allocationMethod !== "excluded")
          .map((c) => ({ id: c.id, name: c.name }))}
        rows={data.expenses.map(({ expense: e, category: c }) => ({
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
        }))}
      />
    </div>
  );
}

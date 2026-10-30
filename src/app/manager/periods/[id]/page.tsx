import { Select } from "@/components/ui/select";
import { PeriodActions } from "@/components/finance/period-actions";
import { ExpenseActions } from "@/components/finance/expense-actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import {
  ArrowRight,
  Download,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import {
  ActionButton,
  ActionForm,
  FormModal,
} from "@/components/finance/forms";
import { JalaliDateField } from "@/components/finance/calendar";
import { PeriodUnits } from "@/components/finance/period-units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/finance/money-input";
import {
  addExpenseLine,
  finalizePeriod,
  previewPeriod,
} from "@/lib/actions/building";
import { db } from "@/lib/db";
import { billingPeriod, invoiceLineItem, unitInvoice } from "@/lib/db/schema";
import { getFinanceData } from "@/lib/queries/finance";
import { requireManager } from "@/lib/session";
import { formatToman, tomanInputToRial } from "@/lib/format/money";
import { formatJalaliDate, isoDate } from "@/lib/format/jalali";
import { formatAllocationBasis } from "@/lib/format/allocation-basis";
import { getPeriodChargePlan } from "@/lib/queries/charge-plan";
import { PeriodChargePlanningCards } from "@/components/finance/period-charge-planning";
import { costCoveredByCharge } from "@/lib/billing/charge-model";
import { BillCoverageField } from "@/components/finance/bill-coverage-field";
import { UtilityBillFields } from "@/components/finance/utility-bill-fields";
import { utilityBillFromForm } from "@/lib/billing/utility-bill";
export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member } = await requireManager();
  const period = await db.query.billingPeriod.findFirst({
    where: and(
      eq(billingPeriod.id, id),
      eq(billingPeriod.buildingId, member.buildingId),
    ),
  });
  if (!period || period.deletedAt) notFound();
  const data = await getFinanceData(member.buildingId);
  const chargePlan = await getPeriodChargePlan(member.buildingId, id, data);
  const expenses = data.expenses.filter((r) => r.expense.periodId === id);
  const preview = period.status === "draft" ? await previewPeriod(id) : null;
  const invoices = data.invoices.filter((r) => r.invoice.periodId === id);
  const lines = await db
    .select({ line: invoiceLineItem, invoice: unitInvoice })
    .from(invoiceLineItem)
    .innerJoin(unitInvoice, eq(invoiceLineItem.invoiceId, unitInvoice.id))
    .where(eq(unitInvoice.periodId, id));
  async function save(f: FormData) {
    "use server";
    await addExpenseLine({
      coverageMonths: f.get("coverageMonths")
        ? Number(f.get("coverageMonths"))
        : null,
      billingTreatment: String(f.get("billingTreatment") || "auto") as
        "auto" | "separate",
      periodId: id,
      categoryId: String(f.get("categoryId")),
      amountRial: tomanInputToRial(f.get("amountToman")),
      expenseDate: String(f.get("expenseDate")),
      utilityBill: utilityBillFromForm(f),
      description: String(f.get("description") || ""),
    });
  }
  const rows = data.units
    .filter((u) => period.status !== "draft" || !u.deletedAt)
    .map((u) => {
      const invoice = invoices.find((r) => r.invoice.unitId === u.id)?.invoice;
      const snapshotLines = lines
        .filter((r) => r.invoice.unitId === u.id)
        .map((r) => ({
          name: r.line.title,
          basis: formatAllocationBasis(r.line.basis) || "",
          amount: r.line.amountRial,
        }));
      return {
        id: u.id,
        label: u.label,
        name: u.tenantName || u.ownerName || "نام ثبت نشده",
        total: invoice?.subtotalRial ?? preview?.byUnit[u.id]?.totalRial ?? 0,
        balance:
          invoice?.balanceRial ??
          data.settlement.shares
            .filter((s) => s.unitId === u.id && s.periodId === id)
            .reduce((sum, s) => sum + s.balanceRial, 0),
        invoiceId: invoice?.id ?? null,
        lines: invoice
          ? snapshotLines
          : (preview?.byUnit[u.id]?.lines ?? []).map((l) => ({
              name: l.categoryName,
              basis: l.basis,
              amount: l.amountRial,
            })),
      };
    });
  return (
    <div className="space-y-6">
      <Link
        href="/manager/periods"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowRight size={15} />
        بازگشت به دوره‌ها
      </Link>
      <div className="page-heading">
        <div>
          <h1>{period.title}</h1>
          <p>
            {formatJalaliDate(period.startDate)} تا{" "}
            {formatJalaliDate(period.endDate)} · سررسید{" "}
            {period.dueDate ? formatJalaliDate(period.dueDate) : "تعیین نشده"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`status ${period.status === "draft" ? "status-warning" : "status-success"}`}
          >
            {period.status === "draft" ? "پیش‌نویس" : "نهایی‌شده"}
          </span>
          {period.status === "draft" ? (
            <ActionButton
              action={async () => {
                "use server";
                await finalizePeriod(id);
              }}
              variant="default"
              confirm="پس از نهایی‌سازی، جمعیت واحدها و جزئیات هزینه این دوره ثابت می‌ماند و فیش ساکنان صادر می‌شود. ادامه می‌دهید؟"
            >
              نهایی‌سازی و صدور فیش
            </ActionButton>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/api/export/period/${id}/excel`}>
                <Download size={16} />
                خروجی Excel
              </Link>
            </Button>
          )}
        </div>
      </div>
      <PeriodActions
        detail
        period={{
          ...period,
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString(),
          dueDate: period.dueDate?.toISOString() ?? null,
        }}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "هزینه‌های ثبت‌شده",
            value: expenses.reduce((s, r) => s + r.expense.amountRial, 0),
          },
          {
            label: "جمع قابل مطالبه از واحدها",
            value: rows.reduce((s, r) => s + r.total, 0),
          },
          {
            label:
              period.status === "draft"
                ? "مبلغ در انتظار صدور"
                : "مانده قابل پرداخت این دوره",
            value: rows.reduce((s, r) => s + r.balance, 0),
          },
        ].map((s) => (
          <div key={s.label} className="panel p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-3 text-xl font-bold">{formatToman(s.value)}</p>
          </div>
        ))}
      </div>
      <PeriodChargePlanningCards periodId={id} plan={chargePlan} />
      <section className="panel">
        <div className="panel-head flex-wrap gap-4">
          <div>
            <h2 className="panel-title">ریز هزینه‌های دوره</h2>
            <p className="panel-subtitle">
              {chargePlan.fund
                ? "دفتر هزینه‌ها؛ هزینه‌های مشترک از محل شارژ تأمین می‌شوند"
                : "مبنای محاسبه سهم هر واحد"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a
                href={`/api/export/period/${id}/expenses/pdf`}
                aria-label="دانلود PDF ریز هزینه‌های دوره"
              >
                <FileText size={16} />
                PDF هزینه‌ها
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={`/api/export/period/${id}/expenses/png`}
                aria-label="دانلود تصویر ریز هزینه‌های دوره"
              >
                <ImageIcon size={16} />
                تصویر هزینه‌ها
              </a>
            </Button>
            {period.status === "draft" && (
              <FormModal
                title="افزودن هزینه"
                description="مبلغ واقعی هزینه ساختمان را وارد کنید."
              >
                <ActionForm action={save} className="form-grid">
                  <div className="form-field">
                    <label htmlFor="detail-cat">دسته هزینه</label>
                    <Select id="detail-cat" name="categoryId">
                      {data.categories
                        .filter(
                          (c) => c.active && c.allocationMethod !== "excluded",
                        )
                        .map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="detail-amount">مبلغ (تومان)</label>
                    <MoneyInput
                      id="detail-amount"
                      name="amountToman"
                      placeholder="مثلاً ۴٬۵۰۰٬۰۰۰"
                      required
                    />
                  </div>
                  <JalaliDateField
                    name="expenseDate"
                    label="تاریخ هزینه"
                    defaultValue={isoDate(new Date())}
                    required
                  />
                  <div className="form-field">
                    <label htmlFor="detail-desc">شرح هزینه</label>
                    <Input id="detail-desc" name="description" />
                  </div>
                  <BillCoverageField />
                  <UtilityBillFields />
                  <div className="form-field col-span-full">
                    <label htmlFor="detail-billing">روش تأمین هزینه</label>
                    <Select
                      id="detail-billing"
                      name="billingTreatment"
                      defaultValue="auto"
                    >
                      <option value="auto">
                        از محل شارژ؛ آب جدا بر اساس نفرات
                      </option>
                      <option value="separate">
                        دریافت جداگانه از واحدها (فوق‌العاده)
                      </option>
                    </Select>
                  </div>
                  <Button type="submit" className="w-fit">
                    افزودن هزینه
                  </Button>
                </ActionForm>
              </FormModal>
            )}
          </div>
        </div>
        <div className="px-6 pb-4">
          {expenses.length ? (
            expenses.map(({ expense: e, category: c }) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-4"
              >
                <div>
                  <p className="text-xs font-medium">
                    {e.description || c.name}
                  </p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {c.name} · {formatJalaliDate(e.expenseDate)}
                    {chargePlan.fund && (
                      <>
                        {" "}
                        ·{" "}
                        {costCoveredByCharge(c, e, true)
                          ? "از محل شارژ"
                          : "دریافت جداگانه"}
                      </>
                    )}
                    {e.maintenanceTicketId && (
                      <Link
                        className="ms-2 text-primary"
                        href={`/manager/maintenance?ticket=${e.maintenanceTicketId}`}
                      >
                        درخواست مرتبط
                      </Link>
                    )}
                  </p>
                </div>
                <span className="text-xs font-medium">
                  {formatToman(e.amountRial)}
                </span>
                <ExpenseActions
                  standaloneId={
                    data.standaloneExpenses.find(
                      (cost) => cost.linkedExpenseId === e.id,
                    )?.id
                  }
                  expense={{
                    billingTreatment: e.billingTreatment,
                    coverageMonths: e.coverageMonths,
                    utilityBill: e.utilityBill,
                    id: e.id,
                    maintenanceTicketId: e.maintenanceTicketId,
                    categoryId: e.categoryId,
                    amount: e.amountRial,
                    description: e.description ?? "",
                    date: e.expenseDate.toISOString(),
                    draft: period.status === "draft",
                  }}
                  tickets={data.maintenance
                    .filter((t) => !t.deletedAt)
                    .map((t) => ({ id: t.id, title: t.title }))}
                  categories={data.categories
                    .filter(
                      (c) => c.active && c.allocationMethod !== "excluded",
                    )
                    .map((c) => ({ id: c.id, name: c.name }))}
                />
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">
              اولین هزینه این دوره را اضافه کنید.
            </p>
          )}
        </div>
      </section>
      <PeriodUnits rows={rows} finalized={period.status !== "draft"} />
    </div>
  );
}

import Link from "next/link";
import { requireManager } from "@/lib/session";
import { getFinanceData } from "@/lib/queries/finance";
import { isoDate, formatJalaliDate } from "@/lib/format/jalali";
import { formatToman } from "@/lib/format/money";
import { utilityKinds } from "@/lib/billing/utility-bill";
import {
  UtilityBillFields,
  UtilityBillDetails,
} from "@/components/finance/utility-bill-fields";
import { ActionForm, FormModal } from "@/components/finance/forms";
import { Button } from "@/components/ui/button";
import { saveUtilityBillDetails } from "@/lib/actions/notifications";
import { CostPaymentButton } from "@/components/finance/treasury";

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { member } = await requireManager(),
    finance = await getFinanceData(member.buildingId);
  const requested = (await searchParams).state ?? "pending";
  const filter = ["all", "paid", "pending", "overdue"].includes(requested)
      ? requested
      : "pending",
    today = isoDate(new Date());
  const bills = finance.treasury.costs.filter((c) => c.utilityBill);
  const rows = bills
    .filter(
      (c) =>
        filter === "all" ||
        (filter === "paid" && c.settled) ||
        (filter === "pending" && !c.settled) ||
        (filter === "overdue" &&
          !c.settled &&
          !!c.utilityBill?.dueOn &&
          c.utilityBill.dueOn < today),
    )
    .sort((a, b) =>
      (a.utilityBill?.dueOn || "9999").localeCompare(
        b.utilityBill?.dueOn || "9999",
      ),
    );
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>قبوض و سررسیدها</h1>
          <p>
            تاریخ دریافت و مصرف، مهلت شرکت خدماتی و وضعیت پرداخت واقعی ساختمان.
          </p>
        </div>
        <Button asChild>
          <Link href="/manager/expenses?new=1">ثبت قبض / هزینه جدید</Link>
        </Button>
      </div>
      <nav
        aria-label="وضعیت قبوض"
        className="flex flex-wrap gap-6 border-b border-border"
      >
        {[
          ["pending", "پرداخت‌نشده"],
          ["overdue", "مهلت گذشته"],
          ["paid", "پرداخت‌شده"],
          ["all", "همه قبوض"],
        ].map(([k, l]) => (
          <Link
            key={k}
            href={`/manager/bills?state=${k}`}
            className={`border-b-2 pb-3 text-xs ${k === filter ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground"}`}
          >
            {l}
          </Link>
        ))}
      </nav>
      <p className="text-xs text-muted-foreground">
        {rows.length.toLocaleString("fa-IR")} قبض ·{" "}
        <Link
          href="/manager/notifications?tab=automation"
          className="underline underline-offset-4"
        >
          تنظیم یادآوری سررسید
        </Link>
      </p>
      {rows.length ? (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {rows.map((c) => (
            <section key={c.key} className="panel p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">{c.title}</h2>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {utilityKinds[c.utilityBill!.kind]} · {c.periodTitle}
                  </p>
                </div>
                <span
                  className={`status ${c.settled ? "status-success" : c.utilityBill?.dueOn && c.utilityBill.dueOn < today ? "status-warning" : "status-neutral"}`}
                >
                  {c.state}
                </span>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    مبلغ کل ثبت‌شده
                  </p>
                  <p className="mt-2 text-xl font-semibold tabular-nums">
                    {formatToman(c.estimateRial)}
                  </p>
                </div>
                <div className="text-end text-xs">
                  <p className="text-muted-foreground">آخرین مهلت</p>
                  <p className="mt-2">
                    {c.utilityBill?.dueOn
                      ? formatJalaliDate(
                          new Date(`${c.utilityBill.dueOn}T12:00:00Z`),
                        )
                      : "ثبت نشده"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-5 border-y border-border py-4 text-xs">
                <p>پرداخت واقعی: {formatToman(c.paidRial)}</p>
                <p>مانده برآورد: {formatToman(c.remainingRial)}</p>
                <p>
                  تاریخ پرداخت از حساب:{" "}
                  {finance.disbursements
                    .filter(
                      (d) =>
                        !d.cancelledAt &&
                        (c.target.standaloneExpenseId
                          ? d.standaloneExpenseId ===
                            c.target.standaloneExpenseId
                          : d.expenseId === c.target.expenseId),
                    )
                    .map((d) => formatJalaliDate(d.paidAt))
                    .join("، ") || "ثبت نشده"}
                </p>
              </div>
              <details>
                <summary className="text-xs font-medium">
                  شناسه‌ها، تاریخ‌ها و ریز قبض
                </summary>
                <div className="pt-5">
                  <UtilityBillDetails bill={c.utilityBill!} />
                </div>
              </details>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild variant="ghost">
                  <Link
                    href={
                      c.target.standaloneExpenseId
                        ? `/manager/expenses/independent/${c.target.standaloneExpenseId}`
                        : "/manager/expenses#fund-payments"
                    }
                  >
                    اسناد پرداخت
                  </Link>
                </Button>
                <CostPaymentButton
                  cost={c}
                  balance={finance.treasury.balanceRial}
                  today={today}
                />
                <FormModal
                  title="ویرایش اطلاعات قبض"
                  description="ویرایش شناسه‌ها و سررسید، مبلغ شارژ یا پرداخت واقعی را تغییر نمی‌دهد."
                  trigger={
                    <Button variant="outline">ویرایش اطلاعات قبض</Button>
                  }
                >
                  <ActionForm
                    action={saveUtilityBillDetails.bind(null, c.target)}
                    className="grid gap-6"
                  >
                    <UtilityBillFields initial={c.utilityBill} alwaysOpen />
                    <Button type="submit" className="w-fit">
                      ذخیره اطلاعات قبض
                    </Button>
                  </ActionForm>
                </FormModal>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="panel p-8">
          <p className="text-sm font-medium">قبضی در این فهرست نیست.</p>
          <p className="mt-3 text-xs leading-7 text-muted-foreground">
            هنگام ثبت یا ویرایش هزینه، «ثبت اطلاعات قبض» را روشن کنید. هر قبض و
            دوره مصرف آن یک رکورد مستقل دارد.
          </p>
        </section>
      )}
    </div>
  );
}

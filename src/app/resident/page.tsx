import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  ArrowUpLeft,
  Receipt,
  Wallet,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/finance/forms";
import { db } from "@/lib/db";
import { appNotification } from "@/lib/db/schema";
import { requireResident } from "@/lib/session";
import { getFinanceData } from "@/lib/queries/finance";
import { CostSettlements } from "@/components/finance/cost-settlements";
import { formatToman } from "@/lib/format/money";
import { formatJalaliDate } from "@/lib/format/jalali";
export default async function ResidentDashboardPage() {
  const { session, member } = await requireResident();
  if (!member.unitId)
    return (
      <EmptyState
        title="واحد شما هنوز متصل نشده"
        description="از مدیر ساختمان بخواهید حساب شما را به واحدتان متصل کند."
      />
    );
  const [finance, notifications] = await Promise.all([
    getFinanceData(member.buildingId),
    db
      .select()
      .from(appNotification)
      .where(eq(appNotification.userId, session.user.id))
      .orderBy(desc(appNotification.createdAt))
      .limit(6),
  ]);
  const invoices = finance.invoices
    .filter((r) => r.invoice.unitId === member.unitId)
    .sort(
      (a, b) =>
        b.period.startDate.getTime() - a.period.startDate.getTime() ||
        b.period.createdAt.getTime() - a.period.createdAt.getTime(),
    );
  const payments = finance.payments
    .filter((r) => r.payment.unitId === member.unitId)
    .map((r) => r.payment);
  const u = finance.units.find((r) => r.id === member.unitId);
  const latest = invoices[0];
  const account = finance.settlement.accounts.find(
    (a) => a.unitId === member.unitId,
  )!;
  const balance = account.balanceRial;
  const lines = latest
    ? finance.invoiceLines
        .filter((l) => l.invoiceId === latest.invoice.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>{session.user.name.split(" ")[0]} عزیز، به خانه خوش آمدید.</h1>
          <p>واحد {u?.label}؛ فیش‌ها، واریزها و خبرهای ساختمان شما.</p>
        </div>
        <Button asChild>
          <Link href="/resident/payments">
            اعلام واریز شارژ
            <ArrowUpLeft size={16} />
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-6">
          <Wallet size={22} className="mb-5 text-primary" />
          <p className="text-xs text-muted-foreground">
            {balance < 0 ? "بستانکاری شما" : "مانده قابل پرداخت"}
          </p>
          <p className="mt-3 text-2xl font-bold">
            {formatToman(Math.abs(balance))}
          </p>
          <p className="mt-3 text-[10px] text-muted-foreground">
            {balance === 0
              ? account.debtRial > 0
                ? "اعتبار شما بدهی را پوشش می‌دهد؛ مدیر می‌تواند آن را به هزینه‌ها تخصیص دهد"
                : "حساب شما تسویه است"
              : balance < 0
                ? "برای دوره‌های بعد در حساب شما می‌ماند"
                : "بدهی فیش‌ها منهای بستانکاری آزاد"}
          </p>
        </div>
        <div className="panel p-6">
          <Receipt size={22} className="mb-5 text-primary" />
          <p className="text-xs text-muted-foreground">سهم آخرین دوره</p>
          <p className="mt-3 text-2xl font-bold">
            {formatToman(latest?.invoice.subtotalRial ?? 0)}
          </p>
          <p className="mt-3 text-[10px] text-muted-foreground">
            {latest?.period.title ?? "هنوز فیشی صادر نشده"}
          </p>
        </div>
        <div className="panel p-6">
          <CheckCircle size={22} className="mb-5 text-primary" />
          <p className="text-xs text-muted-foreground">
            پرداخت‌های تأییدشده شما
          </p>
          <p className="mt-3 text-2xl font-bold">
            {formatToman(payments.reduce((s, p) => s + p.amountRial, 0))}
          </p>
          <p className="mt-3 text-[10px] text-muted-foreground">
            از ابتدای ثبت حساب ساختمان
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "بدهی تسویه‌نشده فیش‌ها", value: account.debtRial },
          { label: "بستانکاری آزاد", value: account.creditRial },
          {
            label: "پیش‌پرداخت هزینه‌های پیش‌نویس",
            value: account.reservedRial,
          },
        ].map((item) => (
          <div className="panel p-5" key={item.label}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-3 font-bold">{formatToman(item.value)}</p>
          </div>
        ))}
      </div>
      <CostSettlements
        resident
        shares={finance.settlement.shares
          .filter((s) => s.unitId === member.unitId)
          .sort(
            (a, b) =>
              finance.periods.findIndex((p) => p.id === a.periodId) -
              finance.periods.findIndex((p) => p.id === b.periodId),
          )}
        units={finance.units.filter((u) => u.id === member.unitId)}
        accounts={[account]}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">جزئیات آخرین فیش</h2>
              <p className="panel-subtitle">
                {latest?.period.title ?? "سهم هزینه‌های ساختمان"}
              </p>
            </div>
            {latest && (
              <Link
                href={`/api/export/invoice/${latest.invoice.id}/pdf`}
                className="text-xs text-primary"
              >
                دریافت PDF
              </Link>
            )}
          </div>
          {latest ? (
            <div className="px-6 pb-6">
              {lines.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-4 border-t border-border py-4"
                >
                  <div>
                    <p className="text-xs font-medium">{l.title}</p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {l.basis}
                    </p>
                  </div>
                  <span className="text-xs">{formatToman(l.amountRial)}</span>
                </div>
              ))}
              <div className="mt-3 flex justify-between rounded-lg bg-secondary p-4 text-xs">
                <span>سررسید پرداخت</span>
                <span>
                  {latest.period.dueDate
                    ? formatJalaliDate(latest.period.dueDate)
                    : "تعیین نشده"}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="هنوز فیشی صادر نشده است"
              description="پس از نهایی‌سازی دوره توسط مدیر، جزئیات سهم شما اینجا قابل مشاهده است."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">خبرهای حساب شما</h2>
          </div>
          {notifications.length ? (
            <div className="px-6 pb-6">
              {notifications.map((n) => (
                <div key={n.id} className="border-t border-border py-4">
                  <p className="text-xs font-semibold">{n.title}</p>
                  <p className="mt-2 text-xs leading-7 text-muted-foreground">
                    {n.body}
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {formatJalaliDate(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="همه‌چیز مرتب است"
              description="خبر صدور فیش و نتیجه بررسی پرداخت‌ها اینجا نمایش داده می‌شود."
            />
          )}
        </section>
      </div>
    </div>
  );
}

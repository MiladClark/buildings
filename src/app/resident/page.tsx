import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  ArrowUpLeft,
  Receipt,
  Wallet,
  CircleCheck,
  MessageCircle,
  CircleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/finance/forms";
import { db } from "@/lib/db";
import { appNotification } from "@/lib/db/schema";
import { requireResident } from "@/lib/session";
import { getFinanceData } from "@/lib/queries/finance";
import { CostSettlements } from "@/components/finance/cost-settlements";
import { formatToman, formatTomanNumber } from "@/lib/format/money";
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
  const summary = [
    {
      title: balance < 0 ? "بستانکاری شما" : "مانده قابل پرداخت",
      amount: Math.abs(balance),
      description:
        balance === 0
          ? account.debtRial > 0
            ? "اعتبار شما بدهی را پوشش می‌دهد؛ مدیر می‌تواند آن را به هزینه‌ها تخصیص دهد"
            : "حساب شما تسویه است"
          : balance < 0
            ? "برای دوره‌های بعد در حساب شما می‌ماند"
            : "بدهی فیش‌ها منهای بستانکاری آزاد",
      icon: Wallet,
    },
    {
      title: "سهم آخرین دوره",
      amount: latest?.invoice.subtotalRial ?? 0,
      description: latest?.period.title ?? "هنوز فیشی صادر نشده",
      icon: Receipt,
    },
    {
      title: "پرداخت‌های تأییدشده شما",
      amount: payments.reduce((sum, payment) => sum + payment.amountRial, 0),
      description: "از ابتدای ثبت حساب ساختمان",
      icon: CircleCheck,
    },
  ];
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>{session.user.name}، خوش آمدید.</h1>
          <p>واحد {u?.label}؛ فیش‌ها، واریزها و خبرهای ساختمان شما.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/resident/chat">
              <MessageCircle size={17} />
              گفتگوی ساختمان
            </Link>
          </Button>
          <Button asChild>
            <Link href="/resident/payments">
              اعلام واریز شارژ
              <ArrowUpLeft size={16} />
            </Link>
          </Button>
        </div>
      </div>
      <section
        aria-label="خلاصه حساب واحد"
        className="grid max-sm:divide-y max-sm:divide-border max-sm:overflow-hidden max-sm:rounded-xl max-sm:border max-sm:border-border max-sm:bg-card sm:grid-cols-3 sm:gap-4"
      >
        {summary.map((item) => (
          <div
            key={item.title}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-x-3 gap-y-1.5 p-4 sm:block sm:rounded-[14px] sm:border sm:border-border sm:bg-card sm:p-6"
          >
            <item.icon
              size={22}
              aria-hidden="true"
              className="mb-5 hidden text-primary sm:block"
            />
            <p className="text-xs leading-6 text-muted-foreground sm:leading-4">
              {item.title}
            </p>
            <p className="min-w-0 break-words text-left text-base font-bold tabular-nums min-[360px]:text-lg sm:mt-3 sm:text-right sm:text-2xl">
              {formatTomanNumber(item.amount)}{" "}
              <span className="text-[11px] font-normal text-muted-foreground sm:text-2xl sm:font-bold sm:text-foreground">
                تومان
              </span>
            </p>
            <p className="col-span-2 text-[11px] leading-6 text-muted-foreground sm:mt-3 sm:text-[10px] sm:leading-normal">
              {item.description}
            </p>
          </div>
        ))}
      </section>
      {balance > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-bg)] px-4 py-3 text-xs">
          <CircleAlert size={21} className="text-[var(--warning)]" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">مانده قابل پرداخت دارید</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatToman(balance)}
              {latest?.period.dueDate
                ? ` · سررسید ${formatJalaliDate(latest.period.dueDate)}`
                : ""}
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/resident/payments">مشاهده اطلاعات پرداخت</Link>
          </Button>
        </div>
      )}
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
            <Link
              href="/resident/notifications"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              همه اعلان‌ها و تنظیمات
            </Link>
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
    </div>
  );
}

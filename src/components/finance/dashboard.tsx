"use client";
import { RowActions } from "@/components/ui/row-actions";
import { Select } from "@/components/ui/select";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpLeft,
  Plus,
  Download,
  Wallet,
  Receipt,
  Building2,
  ArrowDownLeft,
  CircleCheck,
  ChevronLeft,
  Landmark,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DeferredCalendar,
  DeferredDashboardCharts,
  DeferredDataGrid,
} from "@/components/finance/lazy-section";
import { EmptyState } from "@/components/finance/forms";
import { sendUnitReminder } from "@/lib/actions/building";
import {
  formatToman,
  formatTomanNumber,
  toPersianDigits as fa,
} from "@/lib/format/money";
import { formatJalaliDate } from "@/lib/format/jalali";
import type { DashboardData } from "@/lib/queries/finance";

export function Dashboard({
  data,
  name,
}: {
  data: DashboardData;
  name: string;
}) {
  const [selectedPeriodId, setPeriodId] = useState(
    data.periods[0]?.id ?? "all",
  );
  const periodId =
    selectedPeriodId === "all" ||
    data.periods.some((p) => p.id === selectedPeriodId)
      ? selectedPeriodId
      : (data.periods[0]?.id ?? "all");
  const [tab, setTab] = useState("all");
  const expenses = data.expenses.filter(
    (e) => periodId === "all" || e.periodId === periodId,
  );
  const received = data.payments.reduce((s, p) => s + p.amount, 0);
  const totalDebt = data.summaries.reduce(
    (s, u) => s + Math.max(0, u.balance),
    0,
  );
  const debtors = data.summaries.filter((u) => u.balance > 0).length;
  const occupants = data.summaries.reduce((s, u) => s + u.occupants, 0);
  const categories = Object.entries(
    expenses.reduce<Record<string, number>>((a, e) => {
      a[e.name] = (a[e.name] ?? 0) + e.amount;
      return a;
    }, {}),
  ).map(([name, amount]) => ({ name, amount }));
  const events = data.calendarEvents;
  const rows = useMemo(
    () =>
      data.summaries
        .filter(
          (u) =>
            tab === "all" || (tab === "debt" ? u.balance > 0 : u.balance <= 0),
        )
        .map((u) => ({
          ...u,
          unit: `واحد ${u.label}`,
          persons: u.temporarilyAbsent
            ? "غایب موقت · ۰ نفر"
            : `${fa(String(u.occupants))} نفر`,
          status:
            u.balance < 0
              ? "بستانکار"
              : u.balance > 0
                ? u.overdue
                  ? "سررسید گذشته"
                  : "بدهکار"
                : u.debt > 0
                  ? "نیاز به تخصیص اعتبار"
                  : "تسویه‌شده",
        })),
    [data.summaries, tab],
  );
  const current = data.periods.find((p) => p.id === periodId);
  const stats = [
    {
      label: "موجودی حساب ساختمان",
      value: data.treasury.balanceRial,
      icon: Wallet,
      note: `فقط پرداخت واقعی کسر شده · در انتظار پرداخت: ${formatToman(data.treasury.pendingRial)}`,
      money: true,
    },
    {
      label: "دریافت‌های ثبت‌شده",
      value: received,
      icon: ArrowDownLeft,
      note: `${fa(String(data.payments.length))} واریز تأییدشده تا امروز`,
      money: true,
    },
    {
      label: "مطالبات از واحدها",
      value: totalDebt,
      icon: Receipt,
      note: debtors
        ? `${fa(String(debtors))} واحد دارای مانده بدهی`
        : "هیچ واحدی مانده بدهی ندارد",
      money: true,
    },
    {
      label: "واحدهای ساختمان",
      value: data.summaries.filter((u) => !u.deleted).length,
      icon: Building2,
      note: `${fa(String(occupants))} نفر حاضر · ${fa(String(data.summaries.filter((u) => !u.deleted && u.temporarilyAbsent).length))} واحد غایب موقت · ${fa(String(data.summaries.filter((u) => !u.deleted && u.occupancy === "empty" && !u.temporarilyAbsent).length))} واحد خالی`,
      money: false,
    },
  ];
  return (
    <div className="space-y-6">
      <div className="page-heading !mb-0">
        <div>
          <h1>نمای کلی ساختمان</h1>
          <p>
            {name ? `${name}، ` : ""}مهم‌ترین وضعیت‌های مالی و واحدها را اینجا
            ببینید.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/manager/expenses?view=payments#fund-payments">
              پرداخت هزینه‌ها
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/api/export/finance">
              <Download size={16} />
              دریافت گزارش
            </Link>
          </Button>
          <Button asChild>
            <Link href="/manager/expenses?new=1">
              <Plus size={17} />
              ثبت هزینه جدید
            </Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">نمودار هزینه‌های</span>
          <Select
            aria-label="دوره مالی داشبورد"
            value={periodId}
            onValueChange={(value) => setPeriodId(value)}
            className="border-border text-xs"
          >
            <option value="all">تمام دوره‌ها</option>
            {data.periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          {current && (
            <span
              className={`status ${current.status === "draft" ? "status-warning" : "status-success"}`}
            >
              {current.status === "draft" ? "دوره باز" : "نهایی‌شده"}
            </span>
          )}
        </div>
        <Link
          href="/manager/periods"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
        >
          مدیریت دوره‌ها
          <ChevronLeft size={12} />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        {stats.map((s, i) => (
          <div className="panel min-w-0 p-4 sm:p-5" key={s.label}>
            <div className="mb-5 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                {s.label}
              </span>
              <s.icon
                size={18}
                className={i === 0 ? "text-primary" : "text-muted-foreground"}
                strokeWidth={1.75}
              />
            </div>
            <p
              className={`stat-figure ${i === 0 ? (s.value < 0 ? "text-destructive" : "text-primary") : ""}`}
            >
              <bdi dir="ltr">
                {s.money
                  ? formatTomanNumber(s.value)
                  : fa(s.value.toLocaleString("en-US"))}
              </bdi>
              {s.money && <span className="currency">تومان</span>}
            </p>
            <p className="mt-3 text-[9px] leading-5 text-muted-foreground">
              {s.note}
            </p>
          </div>
        ))}
      </div>
      {data.pendingCount > 0 && (
        <Link
          href="/manager/payments"
          className="flex items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3 text-xs"
        >
          <Landmark size={20} className="text-primary" />
          <span>
            {fa(String(data.pendingCount))} درخواست واریز ساکنان منتظر بررسی
            شماست.
          </span>
          <ArrowUpLeft size={16} className="ms-auto" />
        </Link>
      )}
      {!data.periods.length && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-secondary/50 px-5 py-4">
          <Info size={22} className="text-primary" />
          <div className="flex-1">
            <p className="text-xs font-medium">
              حساب‌وکتاب ساختمان را شروع کنیم
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              واحدها را بررسی کنید، یک دوره بسازید و اولین هزینه ساختمان را ثبت
              کنید.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/manager/periods?new=1">
              ایجاد اولین دوره
              <ChevronLeft size={13} />
            </Link>
          </Button>
        </div>
      )}
      <DeferredDashboardCharts
        timeline={data.cashTimeline}
        categories={categories}
      />
      <div>
        <section className="panel min-w-0">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">وضعیت حساب واحدها</h2>
              <p className="panel-subtitle">
                بدهی تمام فیش‌ها منهای بستانکاری آزاد؛ پیش‌پرداخت هر هزینه جدا
                نگهداری می‌شود
              </p>
            </div>
            <Link
              href="/manager/units"
              className="flex items-center gap-1 whitespace-nowrap text-[10px] text-primary"
            >
              همه واحدها
              <ArrowUpLeft size={13} />
            </Link>
          </div>
          <div className="mx-5 mb-4 flex gap-5 border-b border-border text-[11px]">
            {[
              { id: "all", label: "همه واحدها", count: data.summaries.length },
              { id: "debt", label: "بدهکار", count: debtors },
              {
                id: "settled",
                label: "تسویه و بستانکار",
                count: data.summaries.length - debtors,
              },
            ].map((t) => (
              <button
                key={t.id}
                className={`flex items-center gap-1.5 border-b-2 pb-3 ${tab === t.id ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground"}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                <span className="rounded bg-muted px-1.5 text-[9px]">
                  {fa(String(t.count))}
                </span>
              </button>
            ))}
          </div>
          <DeferredDataGrid
            data={rows}
            columns={[
              { key: "unit", label: "واحد" },
              { key: "name", label: "نام ساکن" },
              { key: "persons", label: "جمعیت" },
              { key: "balance", label: "مانده حساب", type: "money" },
              { key: "status", label: "وضعیت", type: "status" },
            ]}
            searchPlaceholder="جست‌وجوی نام یا شماره واحد"
            filename="unit-balances"
            pageSize={5}
            renderAction={(u) => (
              <RowActions
                items={[
                  ...(u.invoiceId
                    ? [
                        {
                          label: "دریافت فیش PDF",
                          href: `/api/export/invoice/${u.invoiceId}/pdf`,
                        },
                      ]
                    : []),
                  ...(u.balance > 0 && u.canRemind
                    ? [
                        {
                          label: `یادآوری پرداخت واحد ${u.label}`,
                          action: () => sendUnitReminder(u.id),
                          success: "یادآوری در پنل ساکن ثبت شد.",
                        },
                      ]
                    : []),
                ]}
              />
            )}
          />
        </section>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_1fr]">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">آخرین واریزها</h2>
              <p className="panel-subtitle">
                پرداخت‌هایی که در حساب ساختمان ثبت شده‌اند
              </p>
            </div>
            <Link
              href="/manager/payments"
              className="flex items-center gap-1 text-[10px] text-primary"
            >
              مشاهده همه
              <ChevronLeft size={12} />
            </Link>
          </div>
          {data.payments.length ? (
            <div className="px-6 pb-2">
              {data.payments.slice(0, 3).map((p) => (
                <div
                  className="flex items-center gap-3 border-t border-border py-3.5"
                  key={p.id}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <ArrowDownLeft size={17} />
                  </span>
                  <div>
                    <p className="text-xs font-medium">
                      واحد {p.label}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {p.name}
                      </span>
                    </p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {formatJalaliDate(new Date(p.date))} ·{" "}
                      {p.method === "bank_transfer"
                        ? "واریز بانکی"
                        : p.method === "cash"
                          ? "نقدی"
                          : "سایر"}
                    </p>
                  </div>
                  <span className="ms-auto text-xs font-medium">
                    {formatToman(p.amount)}
                  </span>
                  <CircleCheck
                    size={16}
                    className="hidden text-primary sm:block"
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="منتظر اولین واریز"
              description="پرداخت تأییدشده ساکنان یا واریزی که ثبت می‌کنید، اینجا نمایش داده می‌شود."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/manager/payments">ثبت دریافت</Link>
                </Button>
              }
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">تقویم ساختمان</h2>
            <Link
              href="/manager/calendar"
              className="flex items-center gap-1 text-[10px] text-primary"
            >
              مشاهده کامل
              <ChevronLeft size={12} />
            </Link>
          </div>
          <DeferredCalendar events={events} compact />
        </section>
      </div>
    </div>
  );
}

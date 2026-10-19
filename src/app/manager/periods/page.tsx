import Link from "next/link";
import { PeriodActions } from "@/components/finance/period-actions";
import { Receipt } from "@phosphor-icons/react/dist/ssr";
import { FormModal, EmptyState } from "@/components/finance/forms";
import { PeriodCreateForm } from "@/components/finance/period-create-form";

import { getBuildingForUser, listPeriods } from "@/lib/queries/dashboard";
import { requireManager } from "@/lib/session";
import { formatJalaliDate } from "@/lib/format/jalali";

export default async function PeriodsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { member, session } = await requireManager();
  const periods = await listPeriods(member.buildingId);
  const context = await getBuildingForUser(session.user.id);
  const query = await searchParams;
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>شارژ و صورت‌حساب‌ها</h1>
          <p>از ثبت هزینه تا صدور فیش، یک مسیر روشن برای هر دوره.</p>
        </div>
        <FormModal
          title="ایجاد دوره شارژ"
          initialOpen={query.new === "1"}
          description="بازه محاسبه شارژ و آخرین مهلت پرداخت ساکنان را مشخص کنید."
        >
          <PeriodCreateForm defaultDueDay={context?.building.paymentDueDay} />
        </FormModal>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-5">
          <p className="text-xs text-muted-foreground">مسیر صدور فیش</p>
          <p className="mt-3 text-sm font-semibold">
            ۱. ایجاد دوره و ثبت هزینه
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-xs text-muted-foreground">بررسی سهم واحدها</p>
          <p className="mt-3 text-sm font-semibold">۲. مشاهده جزئیات محاسبه</p>
        </div>
        <div className="panel p-5">
          <p className="text-xs text-muted-foreground">نهایی‌سازی و تحویل</p>
          <p className="mt-3 text-sm font-semibold">
            ۳. دریافت فیش PDF، تصویر و Excel
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">دوره‌های مالی ساختمان</h2>
          <Receipt size={21} className="text-muted-foreground" />
        </div>
        {!periods.length ? (
          <EmptyState
            title="اولین دوره را ایجاد کنید"
            description="بعد از ثبت دوره، هزینه‌های ساختمان را وارد کنید تا سهم هر واحد محاسبه شود."
          />
        ) : (
          <div className="divide-y divide-border">
            {periods.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-4 px-6 py-6 transition-colors hover:bg-muted/40"
              >
                <Link
                  href={`/manager/periods/${p.id}`}
                  aria-label={`مشاهده ${p.title}`}
                  className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"
                >
                  <Receipt size={23} weight="duotone" />
                </Link>
                <Link
                  href={`/manager/periods/${p.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {formatJalaliDate(p.startDate)} تا{" "}
                    {formatJalaliDate(p.endDate)}
                  </p>
                </Link>
                <div className="hidden text-[11px] text-muted-foreground sm:block">
                  سررسید{" "}
                  {p.dueDate ? formatJalaliDate(p.dueDate) : "تعیین نشده"}
                </div>
                <span
                  className={`status ${p.status === "draft" ? "status-warning" : "status-success"}`}
                >
                  {p.status === "draft"
                    ? "پیش‌نویس"
                    : p.status === "finalized"
                      ? "نهایی‌شده"
                      : "بایگانی"}
                </span>
                <PeriodActions
                  period={{
                    ...p,
                    startDate: p.startDate.toISOString(),
                    endDate: p.endDate.toISOString(),
                    dueDate: p.dueDate?.toISOString() ?? null,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

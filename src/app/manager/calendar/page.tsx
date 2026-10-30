import { buildingCalendarEvents } from "@/lib/queries/calendar";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { BuildingCalendar } from "@/components/finance/calendar";
import { getFinanceData } from "@/lib/queries/finance";
import { requireManager } from "@/lib/session";
import { isoDate, formatJalaliDate } from "@/lib/format/jalali";
export default async function CalendarPage() {
  const { member } = await requireManager();
  const d = await getFinanceData(member.buildingId);
  const events = buildingCalendarEvents(d);
  const upcoming = events.filter(
    (e) => e.needsPayment && isoDate(new Date(e.date)) >= isoDate(new Date()),
  );
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>تقویم ساختمان</h1>
          <p>سررسید شارژ و قبوض، تاریخ هزینه‌ها و واریزها روی تقویم شمسی.</p>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">روزهای حساب‌وکتاب</h2>
            <CalendarDays size={23} className="text-primary" />
          </div>
          <BuildingCalendar events={events} />
        </section>
        <section className="panel p-6">
          <h2 className="panel-title">سررسیدهای پیش رو</h2>
          <p className="mb-6 mt-2 text-xs leading-6 text-muted-foreground">
            روز سررسید شارژ در تنظیمات ساختمان تعیین می‌شود؛ مهلت هر قبض از
            پرونده همان قبض قابل ویرایش است.
          </p>
          {upcoming.length ? (
            upcoming.map((e) => (
              <Link
                href={e.href}
                key={e.id}
                className="block border-t border-border py-4"
              >
                <p className="text-sm font-medium">{e.title}</p>
                <p className="mt-2 text-xs text-primary">
                  {formatJalaliDate(new Date(e.date))}
                </p>
              </Link>
            ))
          ) : (
            <p className="rounded-lg bg-muted p-4 text-xs leading-6 text-muted-foreground">
              سررسید پرداخت‌نشده‌ای در پیش نیست. دوره‌های پیش‌نویس و تسویه‌شده
              با وضعیت خودشان روی تقویم باقی می‌مانند.
            </p>
          )}
          <Link
            href="/manager/settings"
            className="mt-6 inline-block text-xs text-primary"
          >
            تنظیم روز سررسید
          </Link>
        </section>
      </div>
    </div>
  );
}

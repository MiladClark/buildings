import Link from "next/link";
import { Plus, Send } from "lucide-react";
import { getNotificationPanel } from "@/lib/notifications/queries";
import { ActionButton, FormModal } from "@/components/finance/forms";
import { Button } from "@/components/ui/button";
import { PushDevice } from "./push-device";
import {
  AnnouncementForm,
  NotificationInbox,
  NotificationPreferencesForm,
  NotificationRulesForm,
} from "./forms";
import {
  cancelAnnouncement,
  processBuildingNotifications,
} from "@/lib/actions/notifications";
import { isoDate, formatJalaliDate } from "@/lib/format/jalali";

export async function NotificationsPage({ tab = "inbox" }: { tab?: string }) {
  const data = await getNotificationPanel(),
    manager = data.role === "manager",
    base = manager ? "/manager/notifications" : "/resident/notifications";
  const tabs = [
    ["inbox", "صندوق من"],
    ["preferences", "دریافت اعلان"],
    ...(manager
      ? [
          ["automation", "یادآوری خودکار"],
          ["messages", "اطلاعیه‌های ساختمان"],
        ]
      : []),
  ];
  const current = tabs.some(([id]) => id === tab) ? tab : "inbox";
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>اعلان‌ها</h1>
          <p>
            {manager
              ? "خبرهای حساب، یادآوری شارژ و قبوض و اطلاعیه‌های ساختمان."
              : "خبرهای حساب شما و تنظیمات دریافت اعلان روی گوشی."}
          </p>
        </div>
        {data.management && (
          <FormModal
            title="اطلاعیه جدید"
            description="متن، مخاطبان و زمان ارسال پیام ساختمان را مشخص کنید."
            trigger={
              <Button>
                <Plus size={16} />
                اطلاعیه جدید
              </Button>
            }
          >
            <AnnouncementForm
              units={data.management.units}
              today={isoDate(new Date())}
            />
          </FormModal>
        )}
      </div>
      <nav
        aria-label="بخش‌های اعلان"
        className="flex flex-wrap gap-6 border-b border-border"
      >
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={`${base}?tab=${id}`}
            aria-current={current === id ? "page" : undefined}
            className={`border-b-2 pb-3 text-xs font-medium ${current === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {current === "inbox" && (
        <NotificationInbox
          notices={data.notices.map((n) => ({
            ...n,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      )}
      {current === "preferences" && (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <PushDevice publicKey={data.publicKey} devices={data.devices} />
          <NotificationPreferencesForm
            settings={data.preferences}
            manager={manager}
          />
        </div>
      )}
      {current === "automation" && data.management && (
        <NotificationRulesForm settings={data.management.policy} />
      )}
      {current === "messages" && data.management && (
        <>
          <div className="panel flex flex-wrap items-center justify-between gap-5 p-5">
            <div className="flex flex-wrap gap-6 text-xs">
              {[
                ["pending", "در صف"],
                ["sent", "تحویل سرویس پوش"],
                ["failed", "ناموفق"],
                ["cancelled", "متوقف‌شده"],
              ].map(([k, l]) => (
                <p key={k}>
                  {l}:{" "}
                  <strong>
                    {(
                      data.management!.deliveryCounts.find(
                        (v) => v.status === k,
                      )?.total ?? 0
                    ).toLocaleString("fa-IR")}
                  </strong>
                </p>
              ))}
            </div>
            <ActionButton
              action={processBuildingNotifications}
              success="پیام‌ها و یادآوری‌های آماده بررسی شدند."
            >
              <Send size={14} />
              ارسال پیام‌های آماده
            </ActionButton>
          </div>
          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">اطلاعیه‌های ثبت‌شده</h2>
              <p className="text-xs text-muted-foreground">۲۵ پیام آخر</p>
            </div>
            <ul className="divide-y divide-border">
              {data.management.announcements.map((a) => (
                <li
                  key={a.id}
                  className="p-5 flex items-start justify-between gap-6"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-7 text-muted-foreground">
                      {a.body}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {formatJalaliDate(a.sendAt)} ·{" "}
                      {new Intl.DateTimeFormat("fa-IR", {
                        timeZone: "Asia/Tehran",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(a.sendAt)}{" "}
                      ·{" "}
                      {
                        {
                          all: "همه حساب‌ها",
                          residents: "ساکنان",
                          managers: "مدیران",
                          unit: "واحد مشخص",
                        }[a.audience]
                      }{" "}
                      ·{" "}
                      {a.cancelledAt
                        ? "لغوشده"
                        : a.processedAt
                          ? "پردازش‌شده"
                          : "در انتظار ارسال"}
                    </p>
                  </div>
                  {!a.cancelledAt && !a.processedAt && (
                    <ActionButton
                      variant="outline"
                      action={cancelAnnouncement.bind(null, a.id)}
                      success="ارسال اطلاعیه لغو شد."
                    >
                      لغو ارسال
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
            {!data.management.announcements.length && (
              <p className="p-6 text-xs text-muted-foreground">
                اطلاعیه‌ای ثبت نشده است.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

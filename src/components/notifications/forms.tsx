"use client";
import { useState } from "react";
import Link from "next/link";
import { ActionButton, ActionForm } from "@/components/finance/forms";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { JalaliDateField } from "@/components/finance/calendar";
import {
  notificationKinds,
  notificationLabels,
  type NotificationPolicy,
  type NotificationPreferences,
} from "@/lib/notifications/types";
import {
  saveNotificationRules,
  saveNotificationPreferences,
  createAnnouncement,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { formatJalaliDate } from "@/lib/format/jalali";

function Check({
  name,
  checked,
  children,
}: {
  name: string;
  checked: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 py-1 text-xs leading-7">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {children}
    </label>
  );
}
export function HourSelect({
  name,
  label,
  value,
  minute = false,
}: {
  name: string;
  label: string;
  value: number;
  minute?: boolean;
}) {
  return (
    <div className="form-field">
      <label htmlFor={`notify-${name}`}>{label}</label>
      <Select id={`notify-${name}`} name={name} defaultValue={String(value)}>
        {Array.from({ length: minute ? 60 : 24 }, (_, i) => (
          <option key={i} value={i}>
            {String(i)
              .padStart(2, "0")
              .replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)])}
          </option>
        ))}
      </Select>
    </div>
  );
}
export function NotificationPreferencesForm({
  settings,
  manager,
}: {
  settings: NotificationPreferences;
  manager: boolean;
}) {
  return (
    <section className="panel p-6 space-y-6">
      <div>
        <h2 className="panel-title">ترجیحات اعلان‌های من</h2>
        <p className="panel-subtitle">
          این تنظیمات فقط برای حساب خود شماست. ساعت‌ها به وقت تهران هستند.
        </p>
      </div>
      <ActionForm
        action={saveNotificationPreferences}
        className="grid gap-6"
        success="ترجیحات اعلان ذخیره شد."
      >
        <Check name="pushEnabled" checked={settings.pushEnabled}>
          دریافت اعلان روی دستگاه‌های متصل
        </Check>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-y border-border py-4">
          {notificationKinds
            .filter((k) => manager || k !== "bill_due")
            .map((k) => (
              <Check key={k} name={k} checked={settings[k]}>
                {notificationLabels[k]}
              </Check>
            ))}
          {!manager && (
            <input
              type="hidden"
              name="bill_due"
              value={settings.bill_due ? "on" : "off"}
            />
          )}
        </div>
        <div>
          <p className="mb-5 text-xs font-medium">ساعت سکوت</p>
          <div className="grid grid-cols-2 gap-4">
            <HourSelect
              name="quietStart"
              label="شروع سکوت"
              value={settings.quietStart}
            />
            <HourSelect
              name="quietEnd"
              label="پایان سکوت"
              value={settings.quietEnd}
            />
          </div>
          <p className="mt-3 text-xs leading-7 text-muted-foreground">
            پوش در ساعت سکوت به نوبت بعد موکول می‌شود؛ خبر در صندوق شما باقی
            می‌ماند. برای حذف ساعت سکوت، دو ساعت را برابر بگذارید.
          </p>
        </div>
        <Check name="showDetails" checked={settings.showDetails}>
          نمایش متن کامل پیام روی صفحه قفل گوشی
        </Check>
        <Button type="submit" className="w-fit">
          ذخیره ترجیحات
        </Button>
      </ActionForm>
    </section>
  );
}
export function NotificationRulesForm({
  settings,
}: {
  settings: NotificationPolicy;
}) {
  return (
    <section className="panel p-6 space-y-6 max-w-[1040px]">
      <div>
        <h2 className="panel-title">ارسال خودکار اعلان‌های ساختمان</h2>
        <p className="panel-subtitle">
          صدور فیش و ثبت واریز پس از ثبت عملیات؛ یادآوری سررسیدها در ساعت
          انتخابی.
        </p>
      </div>
      <ActionForm
        action={saveNotificationRules}
        className="grid gap-6"
        success="قواعد اعلان ساختمان ذخیره شد."
      >
        <div className="grid grid-cols-2 gap-4">
          <Check name="enabled" checked={settings.enabled}>
            اعلان‌های ساختمان فعال باشد
          </Check>
          <Check name="pushEnabled" checked={settings.pushEnabled}>
            ارسال پوش به دستگاه‌های مجاز
          </Check>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-y border-border py-4">
          {notificationKinds.map((k) => (
            <Check key={k} name={k} checked={settings[k]}>
              {notificationLabels[k]}
            </Check>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <HourSelect
            name="hour"
            label="ساعت یادآوری روزانه"
            value={settings.hour}
          />
          <HourSelect
            name="minute"
            label="دقیقه"
            value={settings.minute}
            minute
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          <label className="form-field">
            <span>روزهای پیش از سررسید شارژ</span>
            <Input
              name="chargeLeadDays"
              defaultValue={settings.chargeLeadDays.join("، ")}
            />
          </label>
          <label className="form-field">
            <span>روزهای پیش از مهلت قبض</span>
            <Input
              name="billLeadDays"
              defaultValue={settings.billLeadDays.join("، ")}
            />
          </label>
          <p className="col-span-full text-xs leading-7 text-muted-foreground">
            مثلاً «۳، ۱، ۰»: سه روز قبل، یک روز قبل و روز سررسید. بین صفر تا ۳۰
            روز؛ خالی یعنی بدون یادآوری پیش از مهلت.
          </p>
          <label className="form-field">
            <span>فاصله تکرار پس از سررسید (روز)</span>
            <Input
              name="overdueEveryDays"
              type="number"
              min={1}
              max={30}
              required
              defaultValue={settings.overdueEveryDays}
            />
          </label>
          <label className="form-field">
            <span>بیشترین یادآوری پس از سررسید</span>
            <Input
              name="maxOverdue"
              type="number"
              min={0}
              max={12}
              required
              defaultValue={settings.maxOverdue}
            />
          </label>
        </div>
        <p className="text-xs leading-7 text-muted-foreground">
          برای توقف یادآوری پس از سررسید، تعداد را صفر کنید. با تسویه واحد یا
          تأیید پرداخت کامل قبض، یادآوری مرتبط متوقف می‌شود. قبض‌ها فقط به
          مدیران و شارژ فقط به ساکنان همان واحد اعلام می‌شود.
        </p>
        <Button type="submit" className="w-fit">
          ذخیره قواعد اعلان
        </Button>
      </ActionForm>
    </section>
  );
}
export function AnnouncementForm({
  units,
  today,
}: {
  units: { id: string; label: string }[];
  today: string;
}) {
  const [audience, setAudience] = useState("all"),
    [timing, setTiming] = useState("now");
  return (
    <ActionForm
      action={createAnnouncement}
      className="grid gap-6"
      success="پیام ثبت شد و در زمان تعیین‌شده با رعایت تنظیمات مخاطبان ارسال می‌شود."
    >
      <label className="form-field">
        <span>عنوان پیام</span>
        <Input name="title" required maxLength={150} />
      </label>
      <label className="form-field">
        <span>متن اطلاعیه</span>
        <textarea
          name="body"
          required
          maxLength={2000}
          placeholder=" "
          className="form-control form-textarea w-full"
        />
      </label>
      <div className="form-field">
        <label htmlFor="notice-audience">مخاطبان</label>
        <Select
          id="notice-audience"
          name="audience"
          value={audience}
          onValueChange={setAudience}
        >
          <option value="all">همه حساب‌های ساختمان</option>
          <option value="residents">ساکنان</option>
          <option value="managers">مدیران</option>
          <option value="unit">یک واحد مشخص</option>
        </Select>
      </div>
      {audience === "unit" && (
        <div className="form-field">
          <label htmlFor="notice-unit">واحد مخاطب</label>
          <Select id="notice-unit" name="unitId" required>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                واحد {u.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="form-field">
        <label htmlFor="notice-timing">زمان ارسال</label>
        <Select
          id="notice-timing"
          name="timing"
          value={timing}
          onValueChange={setTiming}
        >
          <option value="now">در اولین نوبت ارسال</option>
          <option value="scheduled">در تاریخ و ساعت مشخص</option>
        </Select>
      </div>
      {timing === "scheduled" && (
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-full">
            <JalaliDateField
              name="sendDate"
              label="تاریخ ارسال"
              defaultValue={today}
              required
            />
          </div>
          <HourSelect name="sendHour" label="ساعت ارسال (تهران)" value={9} />
          <HourSelect name="sendMinute" label="دقیقه" value={0} minute />
        </div>
      )}
      <Button type="submit" className="w-fit">
        ثبت اطلاعیه
      </Button>
    </ActionForm>
  );
}
export function NotificationInbox({
  notices,
}: {
  notices: {
    id: string;
    title: string;
    body: string;
    href: string;
    read: boolean;
    createdAt: string;
  }[];
}) {
  const read = async (id?: string) => {
    await markNotificationRead(id);
    window.dispatchEvent(new Event("notifications-updated"));
  };
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">صندوق اعلان‌های من</h2>
          <p className="panel-subtitle">
            ۶۰ خبر آخر حساب شما؛ خبرهای قبلی حفظ می‌شوند.
          </p>
        </div>
        <ActionButton action={() => read()} success="همه اعلان‌ها خوانده شدند.">
          خواندن همه
        </ActionButton>
      </div>
      {notices.length ? (
        <ul className="divide-y divide-border">
          {notices.map((n) => (
            <li key={n.id} className="p-5">
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {!n.read && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    {n.title}
                  </p>
                  <p className="mt-2 text-xs leading-7 text-muted-foreground whitespace-pre-wrap break-words">
                    {n.body}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatJalaliDate(new Date(n.createdAt))}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={n.href}
                      onClick={() => void read(n.id).catch(() => {})}
                    >
                      مشاهده
                    </Link>
                  </Button>
                  {!n.read && (
                    <ActionButton variant="ghost" action={() => read(n.id)}>
                      خواندم
                    </ActionButton>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-6 text-xs leading-7 text-muted-foreground">
          هنوز خبری ثبت نشده است. اعلان صدور فیش، یادآوری شارژ و اطلاعیه‌ها
          اینجا نمایش داده می‌شوند.
        </p>
      )}
    </section>
  );
}

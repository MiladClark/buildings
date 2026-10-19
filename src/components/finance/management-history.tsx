"use client";
import Link from "next/link";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { DataGrid } from "./data-grid";
import { ActionButton, FormModal } from "./forms";
import { Button } from "@/components/ui/button";
import { setRecordDeleted } from "@/lib/actions/management";
import type { RecoverableEntity } from "@/lib/billing/corrections";
import { formatJalaliDate } from "@/lib/format/jalali";
import { formatToman } from "@/lib/format/money";

const names: Record<string, string> = {
  payment: "واریز",
  period: "دوره مالی",
  expense: "هزینه",
  unit: "واحد",
  category: "دسته هزینه",
  maintenance: "تعمیر و درخواست",
  membership: "حساب ساکن",
  request: "اعلام واریز",
  settings: "تنظیمات",
  charge_plan: "برنامه‌ریزی شارژ",
};
const actions: Record<string, string> = {
  release: "برگشت به بستانکاری",
  settle: "تخصیص از بستانکاری",
  edit: "ویرایش",
  delete: "حذف / ابطال",
  restore: "بازیابی",
  reopen: "بازکردن برای اصلاح",
  archive: "بایگانی",
  unarchive: "خروج از بایگانی",
  status: "تغییر وضعیت",
  unlink: "قطع اتصال",
};
const labels: Record<string, string> = {
  title: "عنوان",
  label: "واحد",
  name: "نام",
  amountRial: "مبلغ",
  note: "شرح واریز",
  description: "شرح",
  status: "وضعیت",
  priority: "اولویت",
  scheduledAt: "تاریخ رسیدگی",
  paidAt: "تاریخ واریز",
  startDate: "شروع دوره",
  endDate: "پایان دوره",
  dueDate: "سررسید",
  occupantCount: "نفرات",
  temporarilyAbsent: "غیبت موقت",
  ownerName: "مالک",
  tenantName: "مستأجر",
  floor: "طبقه",
  method: "روش دریافت",
  allocationMethod: "روش تقسیم",
  fixedMonthlyAmount: "مبلغ ثابت",
  manualMonthlyRial: "شارژ ثابت ماهانه هر واحد",
  monthlyReserveRial: "ذخیره ماهانه ساختمان",
  bufferPercent: "حاشیه نوسان هزینه‌ها (٪)",
  roundToRial: "گام گرد کردن پیشنهاد",
  inflationPercent: "تعدیل (٪)",
  includeEmptyUnits: "سهم واحد خالی",
  active: "فعال",
  deletedAt: "حذف‌شده",
};
const values: Record<string, string> = {
  open: "در انتظار رسیدگی",
  in_progress: "در حال رسیدگی",
  resolved: "انجام‌شده",
  draft: "پیش‌نویس",
  finalized: "نهایی‌شده",
  archived: "بایگانی",
  urgent: "فوری",
  normal: "عادی",
  occupied: "دارای مستأجر",
  owner_occupied: "مالک‌نشین",
  empty: "خالی",
  per_person: "بر اساس نفرات",
  per_unit: "مساوی بین واحدها",
  fixed_per_unit: "ثابت هر واحد",
  excluded: "خارج از شارژ",
  cash: "نقدی",
  bank_transfer: "بانکی",
  other: "سایر",
};
function snapshot(json: string | null) {
  if (!json) return null;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
function readable(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (
    [
      "amountRial",
      "fixedMonthlyAmount",
      "manualMonthlyRial",
      "monthlyReserveRial",
      "roundToRial",
    ].includes(key) &&
    typeof value === "number"
  )
    return formatToman(value);
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  if (key.endsWith("At") || key.endsWith("Date"))
    return formatJalaliDate(new Date(String(value)));
  return values[String(value)] ?? String(value);
}
export function ManagementHistory({
  trash,
  events,
}: {
  trash: {
    id: string;
    type: RecoverableEntity;
    label: string;
    date: string;
    detail: string;
  }[];
  events: {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    label: string;
    beforeJson: string | null;
    afterJson: string | null;
    date: string;
  }[];
}) {
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>سابقه و بازیابی</h1>
          <p>
            اصلاح اشتباه‌ها در اختیار شماست؛ موارد حذف‌شده و سابقه تغییرات اینجا
            می‌مانند.
          </p>
        </div>
      </div>
      <section className="rounded-xl border border-border bg-secondary/40 p-5 text-xs leading-7 text-muted-foreground">
        بازیابی واریز، همان دریافت را فعال می‌کند و مبلغ را با مانده فعلی محاسبه
        می‌کند. دوره مالی حذف‌شده به شکل پیش‌نویس برمی‌گردد؛ قبل از صدور دوباره،
        سهم واحدها را بررسی کنید.
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">موارد قابل بازیابی</h2>
            <p className="panel-subtitle">
              حذف‌ها دائمی نیستند؛ هر مورد را جداگانه برگردانید
            </p>
          </div>
          <ArrowCounterClockwise size={22} className="text-primary" />
        </div>
        <DataGrid
          data={trash.map((r) => ({
            ...r,
            kind: names[r.type],
            dateLabel: r.date ? formatJalaliDate(new Date(r.date)) : "—",
          }))}
          filename="management-trash"
          searchPlaceholder="جست‌وجوی موارد حذف‌شده"
          columns={[
            { key: "label", label: "عنوان" },
            { key: "kind", label: "بخش" },
            { key: "dateLabel", label: "تاریخ حذف" },
            { key: "detail", label: "پس از بازیابی" },
          ]}
          emptyTitle="مورد حذف‌شده‌ای نیست"
          emptyDescription="واریز، دوره، هزینه، واحد و درخواست حذف‌شده برای بازیابی اینجا قرار می‌گیرند."
          renderAction={(r) => (
            <ActionButton
              action={() => setRecordDeleted(r.type, r.id, false)}
              confirm={`«${r.label}» بازیابی شود؟ ${r.detail}`}
              success="مورد بازیابی و محاسبات به‌روز شد."
            >
              <ArrowCounterClockwise size={15} />
              بازیابی
            </ActionButton>
          )}
        />
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">دفتر تغییرات مدیر</h2>
            <p className="panel-subtitle">
              سابقه اصلاحات از زمان فعال‌شدن این قابلیت؛ اطلاعات قبل و بعد
              نگهداری می‌شود
            </p>
          </div>
        </div>
        <DataGrid
          data={events.map((r) => ({
            ...r,
            kind: names[r.entityType] ?? r.entityType,
            operation: actions[r.action] ?? r.action,
            dateLabel: `${formatJalaliDate(new Date(r.date))} · ${new Date(r.date).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`,
          }))}
          filename="management-events"
          searchPlaceholder="جست‌وجوی تغییرات"
          columns={[
            { key: "label", label: "عنوان" },
            { key: "kind", label: "بخش" },
            { key: "operation", label: "عملیات" },
            { key: "dateLabel", label: "زمان" },
          ]}
          emptyTitle="هنوز تغییری ثبت نشده"
          emptyDescription="ویرایش، تغییر وضعیت، ابطال و بازیابی‌ها به‌مرور اینجا ثبت می‌شوند."
          renderAction={(r) => {
            const before = snapshot(r.beforeJson),
              after = snapshot(r.afterJson);
            const keys = Object.keys(labels).filter(
              (key) => (before && key in before) || (after && key in after),
            );
            const revokedInvoices = Array.isArray(before?.invoices)
              ? before.invoices
              : [];
            return (
              <FormModal
                title={r.label}
                description={`${r.kind} · ${r.operation} · ${r.dateLabel}`}
                trigger={
                  <Button variant="ghost" size="sm">
                    جزئیات تغییر
                  </Button>
                }
              >
                {keys.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="p-3">فیلد</th>
                          <th className="p-3">قبل</th>
                          <th className="p-3">بعد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keys.map((key) => (
                          <tr className="border-b border-border" key={key}>
                            <td className="p-3">{labels[key]}</td>
                            <td className="p-3 break-words">
                              {readable(key, before?.[key])}
                            </td>
                            <td className="p-3 break-words">
                              {after && key in after
                                ? readable(key, after[key])
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {revokedInvoices.length > 0 && (
                  <p className="rounded-lg bg-muted p-4 text-xs leading-7">
                    نسخه قبلی {revokedInvoices.length.toLocaleString("fa-IR")}{" "}
                    فیش، ریز اقلام و وضعیت سکونت در سابقه محفوظ است. فیش فعال از
                    صفحه دوره دریافت می‌شود.
                  </p>
                )}
                {r.entityType === "period" && (
                  <Link
                    className="mt-5 inline-block text-xs text-primary"
                    href="/manager/periods"
                  >
                    مدیریت دوره‌های مالی
                  </Link>
                )}
              </FormModal>
            );
          }}
        />
      </section>
    </div>
  );
}

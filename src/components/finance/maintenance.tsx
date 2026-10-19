"use client";
import { Select } from "@/components/ui/select";

import Link from "next/link";
import { formatToman } from "@/lib/format/money";
import { useState } from "react";
import { Wrench, CheckCircle, Clock } from "@phosphor-icons/react";
import { ActionForm, ActionButton } from "@/components/finance/forms";
import { LinkedFormModal as FormModal } from "./linked-modal";
import { DataGrid } from "@/components/finance/data-grid";
import { JalaliDateField } from "@/components/finance/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMaintenance, editMaintenance } from "@/lib/actions/maintenance";
import { setRecordDeleted } from "@/lib/actions/management";
import { formatJalaliDate, isoDate } from "@/lib/format/jalali";
export function MaintenanceView({
  tickets,
  manager,
  focusId,
}: {
  tickets: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    date: string;
    scheduled: string | null;
    costs?: { id: string; amount: number; periodId: string; title: string }[];
  }[];
  manager: boolean;
  focusId?: string;
}) {
  const [status, setStatus] = useState("all");
  const rows = [...tickets]
    .sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId))
    .filter((t) => status === "all" || t.status === status)
    .map((t) => ({
      ...t,
      costTotal: t.costs?.reduce((s, c) => s + c.amount, 0) ?? 0,
      dateLabel: formatJalaliDate(new Date(t.date)),
      scheduledLabel: t.scheduled
        ? formatJalaliDate(new Date(t.scheduled))
        : "تعیین نشده",
      priorityLabel: t.priority === "urgent" ? "فوری" : "عادی",
      statusLabel:
        t.status === "resolved"
          ? "انجام‌شده"
          : t.status === "in_progress"
            ? "در حال رسیدگی"
            : "در انتظار رسیدگی",
    }));
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>{manager ? "تعمیرات و درخواست‌ها" : "درخواست رسیدگی"}</h1>
          <p>
            {manager
              ? "از خرابی آسانسور تا روشنایی پارکینگ؛ هر درخواست تا زمان رفع مشکل پیگیری می‌شود."
              : "مشکل مشاعات یا نیاز به تعمیر را ثبت کنید و وضعیت رسیدگی مدیر را ببینید."}
          </p>
        </div>
        <FormModal
          title="درخواست جدید"
          description="شرح مشکل و محل آن را دقیق بنویسید تا رسیدگی سریع‌تر انجام شود."
        >
          <ActionForm action={createMaintenance} className="form-grid">
            <div className="form-field col-span-full">
              <label htmlFor="ticket-title">عنوان درخواست</label>
              <Input
                id="ticket-title"
                name="title"
                placeholder="مثلاً خرابی چراغ راه‌پله طبقه دوم"
                required
                maxLength={150}
              />
            </div>
            <div className="form-field col-span-full">
              <label htmlFor="ticket-description">شرح و محل مشکل</label>
              <textarea
                id="ticket-description"
                name="description"
                className="form-control form-textarea w-full"
                maxLength={3000}
              />
            </div>
            <div className="form-field">
              <label htmlFor="ticket-priority">اولویت</label>
              <Select id="ticket-priority" name="priority">
                <option value="normal">عادی</option>
                <option value="urgent">فوری</option>
              </Select>
            </div>
            {manager && (
              <JalaliDateField
                name="scheduledAt"
                label="تاریخ برنامه‌ریزی‌شده"
              />
            )}
            <Button className="w-fit col-span-full" type="submit">
              ثبت درخواست
            </Button>
          </ActionForm>
        </FormModal>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "در انتظار رسیدگی",
            value: tickets.filter((t) => t.status === "open").length,
            icon: Wrench,
          },
          {
            label: "در حال رسیدگی",
            value: tickets.filter((t) => t.status === "in_progress").length,
            icon: Clock,
          },
          {
            label: "انجام‌شده",
            value: tickets.filter((t) => t.status === "resolved").length,
            icon: CheckCircle,
          },
        ].map((s) => (
          <div key={s.label} className="panel flex items-center gap-4 p-5">
            <s.icon size={24} className="text-primary" weight="duotone" />
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-2 text-2xl font-bold">
                {s.value.toLocaleString("fa-IR")}
              </p>
            </div>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">فهرست درخواست‌ها</h2>
          <Select
            aria-label="فیلتر وضعیت درخواست"
            value={status}
            onValueChange={(value) => setStatus(value)}
            className="text-xs"
          >
            <option value="all">تمام وضعیت‌ها</option>
            <option value="open">در انتظار رسیدگی</option>
            <option value="in_progress">در حال رسیدگی</option>
            <option value="resolved">انجام‌شده</option>
          </Select>
        </div>
        <DataGrid
          data={rows}
          filename="maintenance-requests"
          searchPlaceholder="جست‌وجو در عنوان و شرح درخواست"
          columns={[
            { key: "title", label: "درخواست" },
            { key: "priorityLabel", label: "اولویت" },
            { key: "dateLabel", label: "تاریخ ثبت" },
            { key: "scheduledLabel", label: "برنامه رسیدگی" },
            { key: "statusLabel", label: "وضعیت", type: "status" },
            ...(manager
              ? [
                  {
                    key: "costTotal" as const,
                    label: "هزینه ثبت‌شده",
                    type: "money" as const,
                  },
                ]
              : []),
          ]}
          renderAction={(t) => (
            <div className="flex gap-1">
              <FormModal
                title={t.title}
                description={t.description || "توضیح بیشتری ثبت نشده است."}
                trigger={
                  <Button variant="ghost" size="sm">
                    جزئیات
                  </Button>
                }
              >
                <p className="text-xs leading-7 text-muted-foreground">
                  وضعیت: {t.statusLabel}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  اولویت: {t.priorityLabel}
                </p>
                {manager && (
                  <div className="mt-5 space-y-3 border-t border-border pt-4">
                    <p className="text-xs">
                      هزینه‌های مرتبط: {formatToman(t.costTotal)}
                    </p>
                    {t.costs?.map((c) => (
                      <Link
                        className="block text-xs text-primary"
                        key={c.id}
                        href={`/manager/periods/${c.periodId}`}
                      >
                        {c.title} · {formatToman(c.amount)}
                      </Link>
                    ))}
                    <p className="text-[11px] leading-6 text-muted-foreground">
                      وضعیت رسیدگی جدا از حساب هزینه است؛ انجام‌شدن تعمیر، واریز
                      یا تسویه مالی ثبت نمی‌کند.
                    </p>
                  </div>
                )}
              </FormModal>
              {manager && (
                <>
                  <FormModal
                    initialOpen={t.id === focusId}
                    title="ویرایش و تغییر وضعیت"
                    description="می‌توانید وضعیت را به هر مرحله برگردانید، متن را اصلاح کنید یا تاریخ رسیدگی را بردارید."
                    trigger={
                      <Button variant="outline" size="sm">
                        مدیریت
                      </Button>
                    }
                  >
                    <ActionForm
                      action={(f) => editMaintenance(t.id, f)}
                      className="form-grid"
                    >
                      <div className="form-field col-span-full">
                        <label htmlFor={`edit-title-${t.id}`}>
                          عنوان درخواست
                        </label>
                        <Input
                          id={`edit-title-${t.id}`}
                          name="title"
                          defaultValue={t.title}
                          maxLength={150}
                          required
                        />
                      </div>
                      <div className="form-field col-span-full">
                        <label htmlFor={`edit-desc-${t.id}`}>
                          شرح و محل مشکل
                        </label>
                        <textarea
                          id={`edit-desc-${t.id}`}
                          name="description"
                          defaultValue={t.description ?? ""}
                          maxLength={3000}
                          className="form-control form-textarea w-full"
                        />
                      </div>
                      <div className="form-field">
                        <label htmlFor={`edit-status-${t.id}`}>
                          وضعیت رسیدگی
                        </label>
                        <Select
                          id={`edit-status-${t.id}`}
                          name="status"
                          defaultValue={t.status}
                        >
                          <option value="open">در انتظار رسیدگی</option>
                          <option value="in_progress">در حال رسیدگی</option>
                          <option value="resolved">انجام‌شده</option>
                        </Select>
                      </div>
                      <div className="form-field">
                        <label htmlFor={`edit-priority-${t.id}`}>اولویت</label>
                        <Select
                          id={`edit-priority-${t.id}`}
                          name="priority"
                          defaultValue={t.priority}
                        >
                          <option value="normal">عادی</option>
                          <option value="urgent">فوری</option>
                        </Select>
                      </div>
                      <JalaliDateField
                        name="scheduledAt"
                        label="تاریخ برنامه‌ریزی‌شده"
                        defaultValue={
                          t.scheduled
                            ? isoDate(new Date(t.scheduled))
                            : undefined
                        }
                      />
                      <Button type="submit" className="w-fit col-span-full">
                        ذخیره تغییرات
                      </Button>
                    </ActionForm>
                  </FormModal>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/manager/expenses?new=1&ticket=${t.id}`}>
                      ثبت هزینه
                    </Link>
                  </Button>
                  <ActionButton
                    variant="ghost"
                    ariaLabel={`حذف درخواست ${t.title}`}
                    action={() => setRecordDeleted("maintenance", t.id, true)}
                    confirm={`«${t.title}» حذف شود؟ از بخش سابقه و بازیابی قابل برگشت است. هزینه‌های ثبت‌شده این درخواست حذف نمی‌شوند.`}
                  >
                    حذف
                  </ActionButton>
                </>
              )}
            </div>
          )}
        />
      </section>
    </div>
  );
}

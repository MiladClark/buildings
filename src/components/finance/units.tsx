"use client";
import { Select } from "@/components/ui/select";

import { useState } from "react";
import {
  Buildings,
  PencilSimple,
  Trash,
  Users,
  House,
} from "@phosphor-icons/react";
import { DataGrid } from "@/components/finance/data-grid";
import {
  ActionButton,
  ActionForm,
  FormModal,
} from "@/components/finance/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertUnit, deleteUnit } from "@/lib/actions/building";
import { toPersianDigits as fa } from "@/lib/format/money";
import type { unit } from "@/lib/db/schema";
import { effectiveOccupants } from "@/lib/billing/occupancy";

type Unit = typeof unit.$inferSelect;
function UnitForm({ value }: { value?: Unit }) {
  const [absent, setAbsent] = useState(value?.temporarilyAbsent ?? false);
  return (
    <ActionForm
      action={async (f) => {
        await upsertUnit({
          id: value?.id,
          label: String(f.get("label")),
          floor: f.get("floor") ? Number(f.get("floor")) : undefined,
          status: String(f.get("status")) as Unit["status"],
          occupantCount: Number(f.get("occupantCount")),
          temporarilyAbsent: f.get("temporarilyAbsent") === "on",
          ownerName: String(f.get("ownerName") || ""),
          tenantName: String(f.get("tenantName") || ""),
        });
      }}
      className="form-grid"
    >
      <div className="form-field">
        <label htmlFor={`label-${value?.id}`}>شماره یا نام واحد</label>
        <Input
          id={`label-${value?.id}`}
          name="label"
          defaultValue={value?.label}
          placeholder="مثلاً ۴"
          required
          maxLength={50}
        />
      </div>
      <div className="form-field">
        <label htmlFor={`floor-${value?.id}`}>طبقه</label>
        <Input
          id={`floor-${value?.id}`}
          name="floor"
          type="number"
          defaultValue={value?.floor ?? 1}
          min={-10}
          max={200}
        />
      </div>
      <div className="form-field">
        <label htmlFor={`status-${value?.id}`}>وضعیت عادی واحد</label>
        <Select
          id={`status-${value?.id}`}
          name="status"
          defaultValue={value?.status ?? "occupied"}
        >
          <option value="occupied">دارای مستأجر</option>
          <option value="owner_occupied">مالک‌نشین</option>
          <option value="empty">خالی</option>
        </Select>
      </div>
      <div className="form-field">
        <label htmlFor={`count-${value?.id}`}>تعداد نفرات در زمان حضور</label>
        <Input
          id={`count-${value?.id}`}
          name="occupantCount"
          type="number"
          min={0}
          max={100}
          defaultValue={value?.occupantCount ?? 1}
          required
        />
      </div>
      <div className="col-span-full rounded-xl border border-border bg-secondary/40 p-4">
        <label
          className="flex cursor-pointer items-start gap-3 text-xs font-medium"
          htmlFor={`absent-${value?.id}`}
        >
          <input
            id={`absent-${value?.id}`}
            name="temporarilyAbsent"
            type="checkbox"
            checked={absent}
            onChange={(e) => setAbsent(e.target.checked)}
            aria-describedby={`absence-help-${value?.id}`}
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
          />
          همه ساکنان موقتاً غایب‌اند
        </label>
        <p
          id={`absence-help-${value?.id}`}
          className="mt-2 text-[11px] leading-6 text-muted-foreground"
        >
          برای سفر یا نبودن چندماهه مالک یا مستأجر، این گزینه را روشن کنید. تا
          زمان خاموش‌کردن آن، نفرات حاضر صفر و سهم آب صفر است؛ سهم برق مشترک،
          آسانسور، نظافت و شارژ ثابت کامل محاسبه می‌شود. تعداد معمول خانواده حفظ
          می‌شود و با بازگشت دوباره در محاسبه می‌آید.
        </p>
        {absent && (
          <p
            role="status"
            className="mt-3 border-t border-border pt-3 text-xs font-medium text-primary"
          >
            ۰ نفر حاضر · بدون سهم آب · با سهم کامل هزینه‌های مشترک
          </p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor={`owner-${value?.id}`}>نام مالک</label>
        <Input
          id={`owner-${value?.id}`}
          name="ownerName"
          defaultValue={value?.ownerName ?? ""}
        />
      </div>
      <div className="form-field">
        <label htmlFor={`tenant-${value?.id}`}>نام مستأجر</label>
        <Input
          id={`tenant-${value?.id}`}
          name="tenantName"
          defaultValue={value?.tenantName ?? ""}
        />
      </div>
      <p className="col-span-full rounded-lg bg-muted p-3 text-[11px] leading-6 text-muted-foreground">
        غیبت موقت روی پیش‌نویس‌ها و دوره‌های بعد اثر دارد؛ فیش‌های نهایی‌شده
        تغییر نمی‌کنند. وضعیت «خالی» بدون غیبت موقت، تابع تنظیم سهم واحدهای خالی
        است.
      </p>
      <Button type="submit" className="col-span-full w-fit">
        {value ? "ذخیره تغییرات" : "افزودن واحد"}
      </Button>
    </ActionForm>
  );
}
export function UnitsView({ units }: { units: Unit[] }) {
  const rows = units.map((u) => ({
    ...u,
    unit: `واحد ${u.label}`,
    resident: u.tenantName || u.ownerName || "نام ثبت نشده",
    presentCount: effectiveOccupants(u),
    statusLabel: u.temporarilyAbsent
      ? "غایب موقت"
      : u.status === "empty"
        ? "خالی"
        : "مسکونی",
    waterLabel: effectiveOccupants(u) === 0 ? "بدون سهم آب" : "به نسبت نفرات",
  }));
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>واحدها و ساکنان</h1>
          <p>هر واحد، با شرایط خودش؛ مبنای تقسیم منصفانه هزینه‌ها.</p>
        </div>
        <FormModal
          title="افزودن واحد"
          description="اطلاعات واحد و تعداد افرادی را که در آن زندگی می‌کنند وارد کنید."
        >
          <UnitForm />
        </FormModal>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "تعداد واحدها", value: units.length, icon: Buildings },
          {
            label: "نفرات حاضر؛ مبنای آب",
            value: units.reduce((s, u) => s + effectiveOccupants(u), 0),
            icon: Users,
          },
          {
            label: "واحدهای خالی",
            value: units.filter(
              (u) => u.status === "empty" && !u.temporarilyAbsent,
            ).length,
            icon: House,
          },
          {
            label: "واحدهای غایب موقت",
            value: units.filter((u) => u.temporarilyAbsent).length,
            icon: House,
          },
        ].map((s) => (
          <div key={s.label} className="panel flex items-center gap-4 p-5">
            <s.icon size={25} weight="duotone" className="text-primary" />
            <div>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-bold">{fa(String(s.value))}</p>
            </div>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">فهرست واحدها</h2>
          <span className="text-[10px] text-muted-foreground">
            ویرایش نفرات و وضعیت سکونت
          </span>
        </div>
        <DataGrid
          data={rows}
          columns={[
            { key: "unit", label: "واحد" },
            { key: "floor", label: "طبقه", type: "number" },
            { key: "resident", label: "مالک / مستأجر" },
            { key: "presentCount", label: "نفرات حاضر", type: "number" },
            { key: "statusLabel", label: "وضعیت", type: "status" },
            { key: "waterLabel", label: "مبنای آب" },
          ]}
          filename="building-units"
          searchPlaceholder="جست‌وجوی واحد یا نام ساکن"
          renderAction={(u) => (
            <div className="flex gap-1">
              <FormModal
                title={`ویرایش واحد ${u.label}`}
                description="تغییرات برای محاسبه دوره‌های بعد استفاده می‌شوند."
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`ویرایش واحد ${u.label}`}
                  >
                    <PencilSimple size={16} />
                  </Button>
                }
              >
                <UnitForm value={u} />
              </FormModal>
              <ActionButton
                ariaLabel={`حذف واحد ${u.label}`}
                variant="ghost"
                action={() => deleteUnit(u.id)}
                confirm={`واحد ${u.label} حذف شود؟ از محاسبه پیش‌نویس‌ها کنار می‌رود؛ فیش‌ها و مانده قبلی حفظ می‌شوند. از «سابقه و بازیابی» قابل برگشت است.`}
              >
                <Trash size={16} className="text-destructive" />
              </ActionButton>
            </div>
          )}
        />
      </section>
    </div>
  );
}

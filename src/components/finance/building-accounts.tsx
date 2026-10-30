"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActionButton, ActionForm, FormModal } from "./forms";
import {
  createBuildingAccount,
  saveBuildingRole,
  saveManagedPassword,
} from "@/lib/actions/account-management";
import { deleteResidentShell } from "@/lib/actions/resident-accounts";
import { latinDigits } from "@/lib/auth/phone";

type UnitOption = { id: string; label: string };
export type BuildingAccountRow = {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  email: string;
  role: string;
  unitId: string | null;
  active: boolean;
  own: boolean;
};
export function BuildingAccountForm({ units }: { units: UnitOption[] }) {
  const [role, setRole] = useState("resident");
  return (
    <ActionForm
      action={createBuildingAccount}
      className="grid grid-cols-2 gap-x-4 gap-y-6"
      success={
        role === "manager"
          ? "دسترسی مدیریت ثبت شد؛ ورود از صفحه عادی ورود است."
          : "حساب ساکن ثبت شد."
      }
    >
      <div className="col-span-full grid grid-cols-2 gap-4">
        <label className="form-field">
          <span>نام</span>
          <Input name="firstName" maxLength={60} />
        </label>
        <label className="form-field">
          <span>نام خانوادگی</span>
          <Input name="lastName" maxLength={60} />
        </label>
      </div>
      <label className="form-field col-span-full">
        <span>شماره تلفن</span>
        <Input
          name="phone"
          type="tel"
          dir="ltr"
          required
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
        />
      </label>
      <label className="form-field">
        <span>نقش حساب</span>
        <Select
          aria-label="نقش حساب"
          name="role"
          value={role}
          onValueChange={setRole}
        >
          <option value="resident">ساکن / کاربر عادی</option>
          <option value="manager">مدیر ساختمان؛ دسترسی کامل</option>
        </Select>
      </label>
      <label className="form-field">
        <span>{role === "manager" ? "واحد مدیر (اختیاری)" : "واحد ساکن"}</span>
        <Select
          key={role}
          name="unitId"
          aria-label={role === "manager" ? "واحد مدیر (اختیاری)" : "واحد ساکن"}
          required={role === "resident"}
          defaultValue={role === "resident" ? units[0]?.id : ""}
        >
          <option value="">بدون واحد</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              واحد {u.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="form-field">
        <span>
          رمز ورود اولیه {role === "resident" ? "(اختیاری)" : "برای شماره جدید"}
        </span>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={200}
          dir="ltr"
        />
      </label>
      <label className="form-field">
        <span>تکرار رمز</span>
        <Input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={200}
          dir="ltr"
        />
      </label>
      <p className="col-span-full text-xs leading-7 text-muted-foreground">
        {role === "manager"
          ? "مدیر به همه هزینه‌ها، حساب‌ها، تنظیمات و مدیریت کاربران همین ساختمان دسترسی خواهد داشت."
          : "ساکن فقط پنل و اطلاعات واحد خودش را می‌بیند."}
      </p>
      <div className="account-form-actions col-span-full border-t border-border pt-5">
        <Button type="submit">
          {role === "manager" ? "ثبت مدیر ساختمان" : "ثبت حساب ساکن"}
        </Button>
        <span className="text-xs text-muted-foreground">
          حساب فعال با همان رمز خودش وارد می‌شود.
        </span>
      </div>
    </ActionForm>
  );
}
function RoleForm({
  row,
  units,
}: {
  row: BuildingAccountRow;
  units: UnitOption[];
}) {
  const [role, setRole] = useState(
    row.role === "manager" ? "manager" : "resident",
  );
  return (
    <ActionForm
      className="grid gap-6"
      action={(f) => saveBuildingRole(row.id, f)}
      success="نقش و دسترسی حساب به‌روز شد."
    >
      <label className="form-field">
        <span>شماره تلفن این حساب</span>
        <Input
          name="phone"
          type="tel"
          defaultValue={row.phone ?? ""}
          dir="ltr"
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
        />
      </label>
      <label className="form-field">
        <span>نقش حساب</span>
        <Select
          aria-label="نقش حساب"
          name="role"
          value={role}
          onValueChange={setRole}
        >
          <option value="resident" disabled={row.own && row.role === "manager"}>
            ساکن / کاربر عادی
          </option>
          <option value="manager">مدیر ساختمان؛ دسترسی کامل</option>
        </Select>
      </label>
      <label className="form-field">
        <span>واحد مرتبط</span>
        <Select
          aria-label="واحد مرتبط"
          name="unitId"
          defaultValue={row.unitId ?? ""}
        >
          <option value="">بدون واحد</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              واحد {u.label}
            </option>
          ))}
        </Select>
      </label>
      {role === "manager" && !row.active && (
        <>
          <label className="form-field">
            <span>رمز ورود مدیر جدید</span>
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              required
              dir="ltr"
            />
          </label>
          <label className="form-field">
            <span>تکرار رمز</span>
            <Input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              required
              dir="ltr"
            />
          </label>
        </>
      )}
      <p className="text-sm leading-7">
        {role === "manager"
          ? "این حساب با ورود معمولی، به پنل مدیریت کامل ساختمان دسترسی دارد."
          : row.role === "manager"
            ? "دسترسی مدیریت برداشته می‌شود و حساب به پنل ساکن دسترسی دارد."
            : "این حساب فقط دسترسی ساکن دارد."}
      </p>
      <Button type="submit">ذخیره نقش و دسترسی</Button>
    </ActionForm>
  );
}
export function BuildingAccountList({
  rows,
  units,
}: {
  rows: BuildingAccountRow[];
  units: UnitOption[];
}) {
  const [role, setRole] = useState("all");
  const [search, setSearch] = useState("");
  const filtered = rows.filter(
    (r) =>
      (role === "all" || r.role === role) &&
      latinDigits(`${r.name} ${r.phone ?? ""} ${r.email}`)
        .toLowerCase()
        .includes(latinDigits(search.trim()).toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="panel-head flex-wrap gap-4">
        <div>
          <h2 className="panel-title">حساب‌ها و دسترسی‌ها</h2>
          <p className="panel-subtitle">
            {rows
              .filter((r) => r.role === "manager")
              .length.toLocaleString("fa-IR")}{" "}
            مدیر ·{" "}
            {rows
              .filter((r) => r.role === "resident")
              .length.toLocaleString("fa-IR")}{" "}
            ساکن
          </p>
        </div>
        <Select
          aria-label="فیلتر نقش حساب"
          value={role}
          onValueChange={setRole}
        >
          <option value="all">همه نقش‌ها</option>
          <option value="manager">مدیران ساختمان</option>
          <option value="resident">ساکنان</option>
        </Select>
      </div>
      <div className="px-5 pb-5">
        <label className="form-field max-w-md">
          <span>جست‌وجوی حساب</span>
          <Input
            aria-label="جست‌وجوی حساب"
            placeholder="نام، شماره تلفن یا ایمیل"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <ul className="divide-y divide-border">
        {filtered.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-start justify-between gap-4 p-5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold break-words">
                {row.name}
                {row.own ? " (حساب شما)" : ""}
              </p>
              <p
                className="mt-2 text-xs text-muted-foreground break-all"
                dir="ltr"
              >
                {row.phone || "شماره ثبت نشده"}
                {!row.email.endsWith("@residents.internal")
                  ? ` · ${row.email}`
                  : ""}
              </p>
              <p className="mt-2 text-xs">
                {row.role === "manager"
                  ? "مدیر ساختمان؛ دسترسی کامل"
                  : "ساکن / کاربر عادی"}{" "}
                ·{" "}
                {row.unitId
                  ? `واحد ${units.find((u) => u.id === row.unitId)?.label ?? "—"}`
                  : "بدون واحد"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {row.active ? "ورود فعال" : "منتظر ثبت‌نام یا تعیین رمز"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FormModal
                title="نقش و دسترسی حساب"
                description={`${row.name} · ${row.phone || row.email}`}
                trigger={
                  <Button variant="outline" size="sm">
                    نقش و دسترسی
                  </Button>
                }
              >
                <RoleForm row={row} units={units} />
              </FormModal>
              {row.own ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/manager/account">تنظیمات حساب من</Link>
                </Button>
              ) : (
                <FormModal
                  title="تعیین رمز ورود"
                  description={`رمز ورود ${row.name} را تعیین کنید. سوابق حساب حفظ می‌شوند.`}
                  trigger={
                    <Button variant="ghost" size="sm">
                      تعیین رمز ورود
                    </Button>
                  }
                >
                  <ActionForm
                    className="grid gap-6"
                    action={(f) => saveManagedPassword(row.id, f)}
                    success="رمز ورود ذخیره شد."
                  >
                    <label className="form-field">
                      <span>رمز</span>
                      <Input
                        type="password"
                        name="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={200}
                        required
                        dir="ltr"
                      />
                    </label>
                    <label className="form-field">
                      <span>تکرار رمز</span>
                      <Input
                        type="password"
                        name="confirmPassword"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={200}
                        required
                        dir="ltr"
                      />
                    </label>
                    <Button type="submit">ذخیره رمز ورود</Button>
                  </ActionForm>
                </FormModal>
              )}
              {!row.active && row.role === "resident" && (
                <ActionButton
                  variant="ghost"
                  action={() => deleteResidentShell(row.userId)}
                  confirm={`حساب آماده‌شدهٔ ${row.name} حذف شود؟ هنوز ورود فعالی ندارد.`}
                >
                  حذف حساب آماده
                </ActionButton>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!filtered.length && (
        <p className="p-5 text-sm text-muted-foreground">
          حسابی با این مشخصات پیدا نشد.
        </p>
      )}
    </section>
  );
}

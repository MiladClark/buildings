"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ActionButton, ActionForm, FormModal } from "./forms";
import {
  createBuildingAccount,
  saveBuildingRole,
  saveManagedPassword,
} from "@/lib/actions/account-management";
import { deleteResidentShell } from "@/lib/actions/resident-accounts";
import { latinDigits } from "@/lib/auth/phone";
import { KeyRound, Settings, ShieldCheck, Trash2 } from "lucide-react";

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
      <div className="col-span-full space-y-2">
        <label className="form-field">
          <span>شماره تلفن</span>
          <PhoneInput
            name="phone"
            required
            aria-describedby="account-phone-help"
          />
        </label>
        <p
          id="account-phone-help"
          className="text-xs leading-6 text-muted-foreground"
        >
          شماره با ارقام فارسی یا پیش‌شمارهٔ ایران هم پذیرفته می‌شود و خودکار به
          شکل 09123456789 درمی‌آید.
        </p>
      </div>
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
          disabled={role === "resident" && units.length === 0}
          defaultValue={role === "resident" ? units[0]?.id : ""}
        >
          <option value="">
            {role === "manager" ? "بدون واحد" : "واحد را انتخاب کنید"}
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              واحد {u.label}
            </option>
          ))}
        </Select>
      </label>
      {role === "resident" && units.length === 0 && (
        <p
          role="status"
          className="col-span-full text-xs leading-7 text-muted-foreground"
        >
          برای همه واحدهای فعال حساب ساخته شده است. برای تغییر حساب هر واحد از
          «نقش و دسترسی» همان حساب استفاده کنید.
        </p>
      )}
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
        <Button
          type="submit"
          disabled={role === "resident" && units.length === 0}
        >
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
        <PhoneInput name="phone" defaultValue={row.phone ?? ""} />
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
      </div>
      <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
        <SearchInput
          aria-label="جست‌وجوی حساب"
          placeholder="نام، شماره تلفن یا ایمیل"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="form-field w-[200px] max-w-full">
          <span>نقش حساب</span>
          <Select
            aria-label="فیلتر نقش حساب"
            value={role}
            onValueChange={setRole}
          >
            <option value="all">همه نقش‌ها</option>
            <option value="manager">مدیران ساختمان</option>
            <option value="resident">ساکنان</option>
          </Select>
        </label>
      </div>
      <div
        aria-hidden="true"
        className="hidden items-center gap-6 border-y border-border px-5 py-3 text-xs text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_minmax(200px,0.8fr)_124px]"
      >
        <span>حساب و اطلاعات تماس</span>
        <span>دسترسی و وضعیت</span>
        <span className="text-center">عملیات</span>
      </div>
      <ul className="divide-y divide-border">
        {filtered.map((row) => (
          <li
            key={row.id}
            className="grid min-h-28 items-center gap-x-6 gap-y-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(200px,0.8fr)_124px]"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold break-words">
                {row.name}
                {row.own && (
                  <span className="ms-2 text-xs font-normal text-muted-foreground">
                    (حساب شما)
                  </span>
                )}
              </p>
              <div
                dir="rtl"
                className="mt-2 flex min-h-10 flex-col gap-1 text-right text-xs leading-5 text-muted-foreground"
              >
                <bdi
                  dir="ltr"
                  className="block w-full break-all text-right tabular-nums"
                >
                  {row.phone || "شماره ثبت نشده"}
                </bdi>
                {!row.email.endsWith("@residents.internal") && (
                  <bdi dir="ltr" className="block w-full break-all text-right">
                    {row.email}
                  </bdi>
                )}
              </div>
            </div>
            <div className="min-w-0 space-y-2 text-xs leading-5">
              <p className="font-medium">
                {row.role === "manager" ? "مدیر ساختمان" : "ساکن / کاربر عادی"}
              </p>
              <p className="text-muted-foreground">
                {row.role === "manager" && "دسترسی کامل · "}
                {row.unitId
                  ? `واحد ${units.find((u) => u.id === row.unitId)?.label ?? "—"}`
                  : "بدون واحد"}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={`size-1.5 shrink-0 rounded-full ${row.active ? "bg-primary" : "bg-muted-foreground"}`}
                />
                {row.active ? "ورود فعال" : "منتظر ثبت‌نام یا تعیین رمز"}
              </p>
            </div>
            <div className="grid w-[124px] grid-cols-3 items-center gap-2 md:justify-self-end">
              <FormModal
                title="نقش و دسترسی حساب"
                description={`${row.name} · ${row.phone || row.email}`}
                trigger={
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9 p-0"
                    title="نقش و دسترسی"
                    aria-label={`نقش و دسترسی ${row.name}`}
                  >
                    <ShieldCheck size={17} aria-hidden="true" />
                  </Button>
                }
              >
                <RoleForm row={row} units={units} />
              </FormModal>
              {row.own ? (
                <Button
                  size="icon"
                  variant="outline"
                  className="size-9 p-0"
                  asChild
                >
                  <Link
                    href="/manager/account"
                    title="تنظیمات حساب من"
                    aria-label="تنظیمات حساب من"
                  >
                    <Settings size={17} aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <FormModal
                  title="تعیین رمز ورود"
                  description={`رمز ورود ${row.name} را تعیین کنید. سوابق حساب حفظ می‌شوند.`}
                  trigger={
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 p-0"
                      title="تعیین رمز ورود"
                      aria-label={`تعیین رمز ورود ${row.name}`}
                    >
                      <KeyRound size={17} aria-hidden="true" />
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
                  variant="outline"
                  ariaLabel={`حذف حساب آماده ${row.name}`}
                  size="icon"
                  title="حذف حساب آماده"
                  className="group size-9 p-0 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                  action={() => deleteResidentShell(row.userId)}
                  confirm={`حساب آماده‌شدهٔ ${row.name} حذف شود؟ هنوز ورود فعالی ندارد.`}
                >
                  <Trash2
                    size={17}
                    aria-hidden="true"
                    className="group-disabled:hidden"
                  />
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

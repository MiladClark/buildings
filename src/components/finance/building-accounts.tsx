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
  deleteBuildingAccount,
  saveBuildingRole,
  saveManagedPassword,
} from "@/lib/actions/account-management";
import { latinDigits } from "@/lib/auth/phone";
import {
  House,
  KeyRound,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const managerCount = rows.filter((r) => r.role === "manager").length;
  const pendingCount = rows.filter((r) => !r.active).length;
  const unitLabels = new Map(units.map((u) => [u.id, u.label]));
  const filtered = rows.filter(
    (r) =>
      (role === "all" || r.role === role) &&
      (status === "all" || (status === "active" ? r.active : !r.active)) &&
      latinDigits(
        `${r.name} ${r.phone ?? ""} ${r.email} ${unitLabels.get(r.unitId ?? "") ?? ""}`,
      )
        .toLowerCase()
        .includes(latinDigits(search.trim()).toLowerCase()),
  );
  return (
    <section
      className="panel overflow-hidden"
      aria-label="فهرست حساب‌های ساختمان"
    >
      <dl className="grid grid-cols-3 border-b border-border bg-muted/40 px-2 py-5 sm:px-6 sm:py-6">
        {[
          { label: "کل حساب‌ها", value: rows.length },
          { label: "مدیر ساختمان", value: managerCount },
          { label: "منتظر فعال‌سازی", value: pendingCount },
        ].map((item) => (
          <div
            key={item.label}
            className="space-y-1.5 border-s border-border px-3 first:border-s-0 sm:px-5"
          >
            <dt className="text-[11px] text-muted-foreground sm:text-xs">
              {item.label}
            </dt>
            <dd className="text-2xl font-semibold tabular-nums sm:text-3xl">
              {item.value.toLocaleString("fa-IR")}
            </dd>
          </div>
        ))}
      </dl>
      <div className="space-y-5 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">فهرست حساب‌ها</h2>
          <p role="status" className="text-xs text-muted-foreground">
            نمایش {filtered.length.toLocaleString("fa-IR")} از{" "}
            {rows.length.toLocaleString("fa-IR")} حساب
          </p>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <SearchInput
            className="w-full!"
            aria-label="جست‌وجوی حساب"
            placeholder="نام، شماره تماس، ایمیل یا واحد…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="form-field">
            <span>وضعیت ورود</span>
            <Select
              aria-label="فیلتر وضعیت ورود"
              value={status}
              onValueChange={setStatus}
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">ورود فعال</option>
              <option value="pending">منتظر فعال‌سازی</option>
            </Select>
          </label>
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="فیلتر نقش حساب"
        >
          {[
            { value: "all", label: "همه حساب‌ها", count: rows.length },
            { value: "manager", label: "مدیران", count: managerCount },
            {
              value: "resident",
              label: "ساکنان",
              count: rows.filter((r) => r.role === "resident").length,
            },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={role === item.value}
              onClick={() => setRole(item.value)}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs transition-colors",
                role === item.value
                  ? "bg-secondary font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
              <span className="text-[11px] tabular-nums opacity-70">
                {item.count.toLocaleString("fa-IR")}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="hidden items-center gap-5 border-y border-border bg-muted/30 px-6 py-3 text-[11px] font-medium text-muted-foreground xl:grid xl:grid-cols-[minmax(0,1fr)_140px_180px_168px]"
      >
        <span>حساب و اطلاعات تماس</span>
        <span>واحد مرتبط</span>
        <span>دسترسی و وضعیت</span>
        <span className="text-center">عملیات</span>
      </div>
      <ul className="divide-y divide-border">
        {filtered.map((row) => (
          <li
            key={row.id}
            className={cn(
              "grid grid-cols-2 items-center gap-x-5 gap-y-4 px-4 py-5 transition-colors hover:bg-muted/25 sm:px-6 xl:grid-cols-[minmax(0,1fr)_140px_180px_168px]",
              row.own && "bg-secondary/25",
            )}
          >
            <div className="col-span-2 flex min-w-0 items-start gap-3 sm:col-span-1">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  row.role === "manager"
                    ? "bg-secondary text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {row.role === "manager" ? (
                  <ShieldCheck size={20} strokeWidth={1.7} />
                ) : (
                  <Users size={20} strokeWidth={1.7} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold break-words">
                  {row.name}
                  {row.own && (
                    <span className="ms-2 inline-block rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      شما
                    </span>
                  )}
                </p>
                <div
                  dir="rtl"
                  className="mt-1.5 flex flex-col gap-0.5 text-right text-xs leading-5 text-muted-foreground"
                >
                  <bdi
                    dir="ltr"
                    className="block w-full break-all text-right tabular-nums"
                  >
                    {row.phone || "شماره ثبت نشده"}
                  </bdi>
                  {!row.email.endsWith("@residents.internal") && (
                    <bdi
                      dir="ltr"
                      className="block w-full break-all text-right"
                    >
                      {row.email}
                    </bdi>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs sm:justify-self-end xl:justify-self-auto">
              <House
                size={16}
                className="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                {row.unitId
                  ? `واحد ${unitLabels.get(row.unitId) ?? "بایگانی‌شده"}`
                  : "بدون واحد"}
              </span>
            </div>
            <div className="min-w-0 space-y-2 text-xs leading-5">
              <p className="font-medium">
                {row.role === "manager" ? "مدیر ساختمان" : "ساکن / کاربر عادی"}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={`size-1.5 shrink-0 rounded-full ${row.active ? "bg-primary" : "bg-muted-foreground"}`}
                />
                {row.active ? "ورود فعال" : "منتظر فعال‌سازی"}
              </p>
            </div>
            <div className="col-span-2 flex items-center gap-2 border-t border-border/60 pt-3 sm:col-span-1 sm:justify-self-end sm:border-0 sm:pt-0">
              <FormModal
                title="نقش و دسترسی حساب"
                description={`${row.name} · ${row.phone || row.email}`}
                trigger={
                  <Button
                    variant="outline"
                    className="min-w-0 gap-1.5 px-2.5"
                    title="نقش و دسترسی"
                    aria-label={`نقش و دسترسی ${row.name}`}
                  >
                    <ShieldCheck size={17} aria-hidden="true" />
                    دسترسی
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
              {row.own ? (
                <span
                  title={
                    managerCount === 1
                      ? "آخرین مدیر قابل حذف نیست؛ ابتدا مدیر دیگری اضافه کنید."
                      : "برای حذف این حساب، با مدیر دیگری وارد شوید."
                  }
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled
                    aria-label="حذف حساب فعلی غیرفعال است"
                    className="size-9 p-0 text-muted-foreground"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </Button>
                </span>
              ) : (
                <ActionButton
                  variant="outline"
                  ariaLabel={`حذف حساب ${row.name}`}
                  size="icon"
                  title="حذف حساب"
                  className="group size-9 p-0 text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                  action={() => deleteBuildingAccount(row.id)}
                  success="حساب حذف شد؛ واحد و سوابق مالی حفظ شدند."
                  confirm={`حساب ${row.role === "manager" ? "مدیر " : ""}${row.name} حذف شود؟ ورود و دسترسی او به این ساختمان قطع می‌شود. واحد، فیش‌ها، پرداخت‌ها و سوابق قبلی حفظ می‌شوند.`}
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
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <Users
            size={28}
            strokeWidth={1.5}
            className="text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">حسابی با این مشخصات پیدا نشد.</p>
          <p className="text-xs text-muted-foreground">
            عبارت جست‌وجو یا فیلترها را تغییر دهید.
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setRole("all");
              setStatus("all");
            }}
          >
            پاک کردن فیلترها
          </Button>
        </div>
      )}
      <div className="flex items-start gap-2.5 border-t border-border bg-muted/25 px-4 py-4 text-xs leading-7 text-muted-foreground sm:px-6">
        <ShieldCheck size={17} className="mt-1 shrink-0" aria-hidden="true" />
        <p>
          برای حذف حساب فعلی، با حساب مدیر دیگری وارد شوید. همیشه باید دست‌کم یک
          مدیر در ساختمان باقی بماند. حذف حساب، سوابق مالی واحد را پاک نمی‌کند.
        </p>
      </div>
    </section>
  );
}

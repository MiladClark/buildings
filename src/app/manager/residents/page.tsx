import { Select } from "@/components/ui/select";
import { ActionForm, ActionButton } from "@/components/finance/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignResidentMembership, listUnits } from "@/lib/actions/building";
import {
  createResidentShell,
  deleteResidentShell,
  resetResidentPassword,
} from "@/lib/actions/resident-accounts";
import { registrationUnitChoices } from "@/lib/auth/registration-units";
import { registrationUnitNumber } from "@/lib/auth/phone";
import { db } from "@/lib/db";
import { account, membership, user } from "@/lib/db/schema";
import type { ReactNode } from "react";

import { requireManager } from "@/lib/session";
import { unlinkResident } from "@/lib/actions/management";

export default async function ResidentsPage() {
  const { member } = await requireManager();
  const units = await listUnits();
  const registrationUnits = registrationUnitChoices(units);
  const users = await db.select().from(user);
  const memberships = await db.select().from(membership);
  const credentials = await db
    .select({
      userId: account.userId,
      password: account.password,
      providerId: account.providerId,
    })
    .from(account);
  const activated = new Set(
    credentials
      .filter((row) => row.password || row.providerId !== "credential")
      .map((row) => row.userId),
  );
  const candidates = users.filter((person) => {
    const own = memberships.filter((row) => row.userId === person.id);
    if (
      own.some(
        (row) =>
          row.role !== "resident" || row.buildingId !== member.buildingId,
      )
    )
      return false;
    if (own.length > 0 && !activated.has(person.id)) return false;
    return true;
  });
  const residents = memberships.filter(
    (row) => row.buildingId === member.buildingId && row.role === "resident",
  );
  const waiting = residents.filter((row) => !activated.has(row.userId));
  const active = residents.filter((row) => activated.has(row.userId));
  const unitRows = registrationUnits.map((item) => {
    const rows = residents.filter((row) => row.unitId === item.id);
    const entered = rows.find((row) => activated.has(row.userId));
    const pending = rows.find((row) => !activated.has(row.userId));
    const row = entered ?? pending;
    const person = users.find((userRow) => userRow.id === row?.userId);
    const state = entered ? "active" : pending ? "waiting" : "open";
    return {
      id: item.id,
      number: registrationUnitNumber(item.label),
      state,
      name: row ? displayName(person) : "",
    } as const;
  });
  const openCount = unitRows.filter((item) => item.state === "open").length;
  async function assign(form: FormData) {
    "use server";
    await assignResidentMembership(
      String(form.get("userId")),
      String(form.get("unitId")),
    );
  }
  async function createAccount(form: FormData) {
    "use server";
    await createResidentShell(form);
  }
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>حساب ساکنان</h1>
          <p>
            {openCount
              ? `${openCount.toLocaleString("fa-IR")} واحد هنوز حساب ندارد. ثبت‌نام فقط با همان شماره و همان واحدی که اینجا می‌سازید قبول می‌شود.`
              : "همه واحدهای قابل ثبت‌نام حساب دارند. ثبت‌نام فقط با همان شماره و همان واحد قبول می‌شود."}
          </p>
        </div>
      </div>
      <section aria-label="وضعیت واحدها" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {unitRows.map((item) => (
          <div key={item.id} className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">
              واحد {item.number?.toLocaleString("fa-IR") ?? "—"}
            </p>
            <p
              className={
                item.state === "active"
                  ? "mt-1 text-xs font-medium text-[var(--positive)]"
                  : item.state === "waiting"
                    ? "mt-1 text-xs font-medium text-[var(--warning)]"
                    : "mt-1 text-xs text-muted-foreground"
              }
            >
              {item.state === "active"
                ? "وارد شده"
                : item.state === "waiting"
                  ? "منتظر ثبت‌نام"
                  : "بدون حساب"}
            </p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              {item.name || "—"}
            </p>
          </div>
        ))}
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <div className="space-y-6">
        <section className="panel p-6">
          <h2 className="mb-2 panel-title">ساخت حساب با شماره</h2>
          <p className="mb-6 text-[11px] leading-6 text-muted-foreground">
            نام اختیاری است. شماره و واحد باید همان چیزی باشد که همسایه در
            ثبت‌نام وارد می‌کند.
          </p>
          <ActionForm
            action={createAccount}
            className="space-y-5"
            success="حساب ساخته شد. همسایه با همین شماره ثبت‌نام می‌کند."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="form-field">
                <label htmlFor="shell-first">نام</label>
                <Input id="shell-first" name="firstName" autoComplete="off" />
              </div>
              <div className="form-field">
                <label htmlFor="shell-last">نام خانوادگی</label>
                <Input id="shell-last" name="lastName" autoComplete="off" />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="shell-phone">شماره تلفن</label>
              <Input
                id="shell-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                required
                autoComplete="off"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              />
            </div>
            <div className="form-field">
              <label htmlFor="shell-unit">واحد</label>
              <Select id="shell-unit" name="unitId" required>
                {registrationUnits.map((item) => (
                  <option key={item.id} value={item.id}>
                    واحد {registrationUnitNumber(item.label)?.toLocaleString("fa-IR")}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" className="w-full">
              ایجاد حساب
            </Button>
          </ActionForm>
        </section>
        <section className="panel p-6">
          <h2 className="mb-2 panel-title">اتصال حساب بدون واحد</h2>
          <p className="mb-5 text-[11px] leading-6 text-muted-foreground">
            برای همسایه‌ای که خودش ثبت‌نام کرده و هنوز به واحدی وصل نیست.
          </p>
          {candidates.length && registrationUnits.length ? (
            <ActionForm action={assign} className="space-y-5">
              <div className="form-field">
                <label htmlFor="assign-user">حساب ثبت‌نام‌شده</label>
                <Select id="assign-user" name="userId" required>
                  {candidates.map((person) => (
                    <option key={person.id} value={person.id}>
                      {displayName(person)} ({contactOf(person)})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="form-field">
                <label htmlFor="assign-unit">واحد</label>
                <Select id="assign-unit" name="unitId" required>
                  {registrationUnits.map((item) => (
                    <option key={item.id} value={item.id}>
                      واحد {registrationUnitNumber(item.label)?.toLocaleString("fa-IR")}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" className="w-full">
                ذخیره اتصال
              </Button>
            </ActionForm>
          ) : (
            <p className="text-xs leading-7 text-muted-foreground">
              حساب ثبت‌نام‌شده‌ای بدون واحد نیست.
            </p>
          )}
        </section>
        </div>
        <section className="panel p-6">
          <h2 className="panel-title">فهرست حساب‌ها</h2>
          <p className="mb-2 mt-2 text-[11px] leading-6 text-muted-foreground">
            {waiting.length.toLocaleString("fa-IR")} منتظر ثبت‌نام،{" "}
            {active.length.toLocaleString("fa-IR")} وارد شده.
          </p>
          <h3 className="mb-1 mt-6 text-xs font-medium">منتظر ثبت‌نام</h3>
          <p className="mb-2 text-[11px] leading-6 text-muted-foreground">
            تا وقتی رمز یا گوگل نساخته‌اند می‌توانید این ردیف را حذف کنید.
          </p>
          {waiting.length ? (
            waiting.map((row) => {
              const person = users.find((item) => item.id === row.userId);
              return (
                <ResidentRow
                  key={row.id}
                  name={displayName(person)}
                  detail={person?.phone ?? "بدون شماره"}
                  unitLabel={unitNumberLabel(units, row.unitId)}
                  status="منتظر ثبت‌نام"
                  tone="warning"
                  action={
                    <ActionButton
                      variant="ghost"
                      action={async () => {
                        "use server";
                        await deleteResidentShell(row.userId);
                      }}
                      confirm="این حساب حذف شود؟ هنوز رمز ندارد و بعداً می‌توانید دوباره بسازید."
                    >
                      حذف
                    </ActionButton>
                  }
                />
              );
            })
          ) : (
            <p className="border-t border-border py-4 text-xs leading-7 text-muted-foreground">
              حساب منتظری نیست.
            </p>
          )}
          <h3 className="mb-1 mt-6 text-xs font-medium">وارد شده</h3>
          <p className="mb-2 text-[11px] leading-6 text-muted-foreground">
            ریست رمز، ورود گوگل را هم پاک می‌کند. سوابق مالی واحد می‌ماند.
          </p>
          {active.length ? (
            active.map((row) => {
              const person = users.find((item) => item.id === row.userId);
              return (
                <ResidentRow
                  key={row.id}
                  name={displayName(person)}
                  detail={contactOf(person)}
                  unitLabel={unitNumberLabel(units, row.unitId)}
                  status="وارد شده"
                  tone="success"
                  action={
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <ActionButton
                        variant="ghost"
                        action={async () => {
                          "use server";
                          await resetResidentPassword(row.userId);
                        }}
                        confirm="رمز و ورود گوگل این شماره پاک شود؟ سوابق مالی می‌ماند و ساکن می‌تواند دوباره با همین شماره و واحد ثبت‌نام کند."
                      >
                        ریست رمز
                      </ActionButton>
                      {row.unitId ? (
                        <ActionButton
                          variant="ghost"
                          action={async () => {
                            "use server";
                            await unlinkResident(row.id);
                          }}
                          confirm="اتصال حساب به واحد قطع شود؟ حساب کاربری باقی می‌ماند و بعداً می‌توانید دوباره متصلش کنید."
                        >
                          قطع اتصال
                        </ActionButton>
                      ) : null}
                    </div>
                  }
                />
              );
            })
          ) : (
            <p className="border-t border-border py-4 text-xs leading-7 text-muted-foreground">
              هنوز کسی با شماره ساخته‌شده وارد نشده است.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function unitNumberLabel(
  units: { id: string; label: string }[],
  unitId: string | null,
) {
  const label = units.find((item) => item.id === unitId)?.label;
  const number = label ? registrationUnitNumber(label) : null;
  if (number) return number.toLocaleString("fa-IR");
  return label || "تعیین نشده";
}

function displayName(
  person: { name: string; phone: string | null } | undefined,
) {
  if (!person) return "حساب حذف‌شده";
  if (person.phone && person.name === person.phone) return "بدون نام";
  return person.name;
}

function contactOf(
  person: { email: string; phone: string | null } | undefined,
) {
  if (!person) return "";
  if (person.phone) return person.phone;
  if (person.email.endsWith("@residents.internal"))
    return person.email.replace("@residents.internal", "");
  return person.email;
}

function ResidentRow({
  name,
  detail,
  unitLabel,
  status,
  tone,
  action,
}: {
  name: string;
  detail: string;
  unitLabel: string;
  status: string;
  tone: "warning" | "success";
  action: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          <span dir="ltr">{detail}</span>
          <span> · واحد {unitLabel}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={`status status-${tone}`}>{status}</span>
        {action}
      </div>
    </div>
  );
}

import { Select } from "@/components/ui/select";
import {
  ActionForm,
  ActionButton,
  EmptyState,
} from "@/components/finance/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignResidentMembership, listUnits } from "@/lib/actions/building";
import {
  createResidentShell,
  deleteResidentShell,
} from "@/lib/actions/resident-accounts";
import { db } from "@/lib/db";
import { account, membership, user } from "@/lib/db/schema";
import type { ReactNode } from "react";

import { requireManager } from "@/lib/session";
import { unlinkResident } from "@/lib/actions/management";

export default async function ResidentsPage() {
  const { member } = await requireManager();
  const units = await listUnits();
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
            با شماره تلفن حساب را از قبل بسازید. وقتی همسایه با همان شماره
            ثبت‌نام کند، به همین حساب و واحد وصل می‌شود.
          </p>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="mb-6 panel-title">ساخت حساب با شماره</h2>
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
              <Select id="shell-unit" name="unitId">
                <option value="">بدون واحد</option>
                {units.map((item) => (
                  <option key={item.id} value={item.id}>
                    واحد {item.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">ایجاد حساب</Button>
          </ActionForm>
        </section>
        <section className="panel p-6">
          <h2 className="mb-2 panel-title">منتظر ثبت‌نام</h2>
          <p className="mb-4 text-[11px] leading-6 text-muted-foreground">
            برای اتصال خودکار، شماره و واحد را مشخص کنید. تا پیش از ثبت‌نام با
            رمز یا گوگل، این ردیف قابل حذف است.
          </p>
          {waiting.length ? (
            waiting.map((row) => {
              const person = users.find((item) => item.id === row.userId);
              return (
                <ResidentRow
                  key={row.id}
                  name={displayName(person)}
                  detail={person?.phone ?? "بدون شماره"}
                  unitLabel={
                    units.find((item) => item.id === row.unitId)?.label ??
                    "تعیین نشده"
                  }
                  status="منتظر ثبت‌نام"
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
            <p className="text-xs leading-7 text-muted-foreground">
              حساب منتظری نیست.
            </p>
          )}
        </section>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="mb-6 panel-title">اتصال حساب ثبت‌نام‌شده</h2>
          <p className="mb-5 text-[11px] leading-6 text-muted-foreground">
            برای کسی که بدون حساب ازپیش‌ساخته ثبت‌نام کرده است.
          </p>
          {candidates.length && units.length ? (
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
                  {units.map((item) => (
                    <option key={item.id} value={item.id}>
                      واحد {item.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit">ذخیره اتصال</Button>
            </ActionForm>
          ) : (
            <EmptyState
              title="حساب آماده اتصال نیست"
              description="اگر همسایه خودش ثبت‌نام کند و واحد نداشته باشد، اینجا به واحد وصل می‌شود."
            />
          )}
        </section>
        <section className="panel p-6">
          <h2 className="mb-6 panel-title">ساکنان واردشده</h2>
          {active.length ? (
            active.map((row) => {
              const person = users.find((item) => item.id === row.userId);
              return (
                <ResidentRow
                  key={row.id}
                  name={displayName(person)}
                  detail={contactOf(person)}
                  unitLabel={
                    units.find((item) => item.id === row.unitId)?.label ??
                    "تعیین نشده"
                  }
                  status="وارد شده"
                  action={
                    row.unitId ? (
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
                    ) : null
                  }
                />
              );
            })
          ) : (
            <p className="text-xs leading-7 text-muted-foreground">
              هنوز کسی با شماره ساخته‌شده وارد نشده است.
            </p>
          )}
        </section>
      </div>
    </div>
  );
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
  action,
}: {
  name: string;
  detail: string;
  unitLabel: string;
  status: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-4">
      <div>
        <p className="text-xs font-medium">{name}</p>
        <p className="mt-2 text-[10px] text-muted-foreground" dir="ltr">
          {detail}
        </p>
      </div>
      <span className="status status-success">
        {status} · واحد {unitLabel}
      </span>
      {action}
    </div>
  );
}

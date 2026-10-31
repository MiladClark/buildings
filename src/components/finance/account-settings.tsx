import Link from "next/link";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, membership, unit, user } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { googleSignInEnabled } from "@/lib/auth/google-config";
import {
  saveOwnProfile,
  changeOwnPassword,
  saveOwnUnit,
} from "@/lib/actions/account-settings";
import { ActionForm } from "./forms";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { GoogleAccountLink } from "./google-account-link";
import { ConnectResidentAccount } from "./connect-resident-account";

export async function AccountSettings() {
  const login = await requireSession();
  const [person, member, identities, googleEnabled] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, login.user.id) }),
    db.query.membership.findFirst({
      where: eq(membership.userId, login.user.id),
    }),
    db
      .select({ provider: account.providerId })
      .from(account)
      .where(eq(account.userId, login.user.id)),
    googleSignInEnabled(),
  ]);
  if (!person || !member) return null;
  const assignedUnits =
    member.role === "manager"
      ? await db
          .select({ unitId: membership.unitId })
          .from(membership)
          .where(
            and(
              eq(membership.buildingId, member.buildingId),
              ne(membership.userId, login.user.id),
            ),
          )
      : [];
  const assignedUnitIds = new Set(assignedUnits.map((m) => m.unitId));
  const activeUnits =
    member.role === "manager"
      ? await db
          .select({ id: unit.id, label: unit.label })
          .from(unit)
          .where(
            and(eq(unit.buildingId, member.buildingId), isNull(unit.deletedAt)),
          )
          .orderBy(unit.sortOrder, unit.label)
      : [];
  const ownUnitOptions = activeUnits.filter(
    (u) => u.id === member.unitId || !assignedUnitIds.has(u.id),
  );
  const hasGoogle = identities.some((a) => a.provider === "google");
  const email = person.email.endsWith("@residents.internal")
    ? ""
    : person.email;
  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>حساب کاربری من</h1>
          <p>
            {member.role === "manager" ? "مدیر ساختمان" : "ساکن"} · مشخصات حساب
            و رمز ورود
          </p>
        </div>
      </div>
      <div className="panel account-settings-sheet">
        {member.role === "manager" && (
          <section id="my-unit" className="account-settings-row scroll-mt-24">
            <div className="space-y-2">
              <h2>واحد من</h2>
              <p>
                واحد خودتان را انتخاب کنید تا با سوییچ هدر، فیش‌ها و پرداخت‌های
                آن را در پنل عادی ببینید.
              </p>
            </div>
            <div className="space-y-6">
              <ActionForm
                action={saveOwnUnit}
                success="واحد شما ذخیره شد؛ از سوییچ هدر وارد پنل واحدتان شوید."
                className="grid gap-5"
              >
                <label className="form-field">
                  <span>واحد خودم</span>
                  <Select
                    name="unitId"
                    defaultValue={member.unitId ?? ""}
                    aria-label="واحد خودم"
                  >
                    <option value="">واحدی ندارم</option>
                    {ownUnitOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        واحد {u.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="account-form-actions">
                  <Button type="submit" variant="outline">
                    ذخیره واحد من
                  </Button>
                  {member.unitId && (
                    <Button asChild variant="ghost">
                      <Link href="/resident">نمایش پنل واحد من</Link>
                    </Button>
                  )}
                </div>
              </ActionForm>
              <ConnectResidentAccount />
            </div>
          </section>
        )}
        <section className="account-settings-row">
          <div className="space-y-2">
            <h2>مشخصات حساب</h2>
            <p>نام و شماره‌ای که با آن وارد ساختمان می‌شوید.</p>
          </div>
          <div>
            <ActionForm
              action={saveOwnProfile}
              className="grid grid-cols-2 gap-x-4 gap-y-6"
              success="مشخصات حساب ذخیره شد."
            >
              <label className="form-field">
                <span>نام و نام خانوادگی</span>
                <Input
                  name="name"
                  defaultValue={person.name}
                  required
                  maxLength={120}
                  autoComplete="name"
                />
              </label>
              <label className="form-field">
                <span>شماره تلفن</span>
                <PhoneInput
                  name="phone"
                  defaultValue={person.phone ?? ""}
                  required
                />
              </label>
              <label className="form-field col-span-full">
                <span>ایمیل</span>
                <Input
                  value={email || "ثبت نشده"}
                  readOnly
                  dir={email ? "ltr" : "rtl"}
                />
              </label>
              <div className="account-form-actions col-span-full">
                <Button type="submit">ذخیره مشخصات</Button>
              </div>
            </ActionForm>
            {!hasGoogle && googleEnabled && (
              <div className="mt-5">
                <GoogleAccountLink />
              </div>
            )}
          </div>
        </section>
        <section className="account-settings-row">
          <div className="space-y-2">
            <h2>رمز ورود</h2>
            <p>رمز دلخواهتان را وارد و یک‌بار تکرار کنید.</p>
          </div>
          <ActionForm
            action={changeOwnPassword}
            className="grid grid-cols-2 gap-x-4 gap-y-6"
            success="رمز ورود ذخیره شد."
          >
            <label className="form-field">
              <span>رمز</span>
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                required
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
                required
                minLength={8}
                maxLength={200}
                dir="ltr"
              />
            </label>
            <div className="account-form-actions col-span-full">
              <Button type="submit" variant="outline">
                ذخیره رمز
              </Button>
            </div>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}

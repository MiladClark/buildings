import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, membership, user } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { googleSignInEnabled } from "@/lib/auth/google-config";
import {
  saveOwnProfile,
  changeOwnPassword,
} from "@/lib/actions/account-settings";
import { ActionForm } from "./forms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoogleAccountLink } from "./google-account-link";

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
                <Input
                  name="phone"
                  defaultValue={person.phone ?? ""}
                  type="tel"
                  dir="ltr"
                  autoComplete="tel"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
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

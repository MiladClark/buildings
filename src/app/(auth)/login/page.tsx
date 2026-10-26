import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { LoginForm } from "@/components/auth/login-form";
import { AuthFrame } from "@/components/auth/auth-frame";
import { GoogleButton, GoogleOption } from "@/components/auth/google-button";
import { GoogleResidentForm } from "@/components/auth/google-resident-form";
import { googleSignInEnabled } from "@/lib/auth/google-config";
import { registrationUnits } from "@/lib/auth/registration-units";
import { getMembershipForUser, getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const googleEnabled = googleSignInEnabled();
  if (session) {
    const member = await getMembershipForUser(session.user.id);
    if (member && params.connect !== "google") redirect("/");
    const identities = await db.query.account.findMany({
      where: eq(account.userId, session.user.id),
    });
    if (
      !member &&
      identities.length === 1 &&
      identities[0].providerId === "google"
    ) {
      return (
        <AuthFrame>
          <div className="mb-7">
            <h1 className="text-[27px] font-bold">واحدتان را مشخص کنید.</h1>
            <p className="mt-3 text-[13px] leading-7 text-muted-foreground">
              شماره تلفن و واحدی را وارد کنید که مدیر برای شما ثبت کرده است؛
              سوابق همان حساب در دسترس شما قرار می‌گیرد.
            </p>
            <p
              dir="ltr"
              className="mt-3 break-all text-[13px] text-muted-foreground"
            >
              {session.user.email}
            </p>
          </div>
          <GoogleResidentForm units={await registrationUnits()} />
        </AuthFrame>
      );
    }
    if (params.connect === "google" && googleEnabled) {
      return (
        <AuthFrame>
          <h1 className="text-[27px] font-bold">اتصال حساب گوگل</h1>
          <p className="my-5 text-[13px] leading-7 text-muted-foreground">
            با اتصال گوگل، دفعه بعد با همان حساب وارد می‌شوید.
          </p>
          <GoogleButton link />
          <Link
            className="mt-6 block text-center text-sm text-primary"
            href="/"
          >
            رفتن به پنل
          </Link>
        </AuthFrame>
      );
    }
    redirect("/pending");
  }
  const connecting = params.connect === "google" && googleEnabled;
  return (
    <AuthFrame>
      <div className="mb-8">
        <h1 className="text-[27px] font-bold">
          {connecting ? "ابتدا وارد حساب فعلی شوید." : "خوش برگشتید."}
        </h1>
        <p className="mt-3 text-[13px] leading-7 text-muted-foreground">
          {connecting
            ? "شماره تلفن یا ایمیل و رمز فعلی را بزنید؛ سپس حساب گوگل را انتخاب کنید."
            : "برای دیدن حساب‌وکتاب ساختمان، وارد حساب خود شوید."}
        </p>
      </div>
      {params.error && (
        <p role="alert" className="mb-5 text-[13px] leading-7 text-destructive">
          ورود با گوگل انجام نشد. اگر قبلاً با رمز ثبت‌نام کرده‌اید،{" "}
          <Link
            href="/login?connect=google"
            className="underline underline-offset-4"
          >
            از اینجا وارد شوید و گوگل را وصل کنید.
          </Link>
        </p>
      )}
      <LoginForm connectGoogle={connecting} />
      {googleEnabled && !connecting && <GoogleOption />}
      <p className="mt-8 border-t border-border pt-6 text-center text-[13px] text-muted-foreground">
        هنوز حساب ندارید؟{" "}
        <Link href="/register" className="mr-1 font-medium text-primary">
          ساخت حساب کاربری
        </Link>
      </p>
    </AuthFrame>
  );
}

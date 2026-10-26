import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthFrame } from "@/components/auth/auth-frame";
import { countUsers } from "@/lib/queries/dashboard";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { registrationUnits } from "@/lib/auth/registration-units";
import { googleSignInEnabled } from "@/lib/auth/google-config";
import { GoogleOption } from "@/components/auth/google-button";
export default async function RegisterPage() {
  await connection();
  if (await getSession()) redirect("/");
  const first = (await countUsers()) === 0;
  const units = await registrationUnits();
  return (
    <AuthFrame>
      <div className="mb-8">
        <h1 className="text-[27px] font-bold">
          {first ? "به واحدبان خوش آمدید." : "همسایه جدید، خوش آمدید."}
        </h1>
        {!first && (
          <p className="mt-3 text-[13px] leading-7 text-muted-foreground">
            نام، شماره تلفن و واحد ۱ تا ۸ را وارد کنید. فقط شماره‌ای که مدیر
            ساخته می‌تواند ثبت‌نام کند و به همان حساب وصل می‌شود.
          </p>
        )}
      </div>
      <RegisterForm isFirstUser={first} units={units} />
      {(await googleSignInEnabled()) && <GoogleOption />}
      <p className="mt-8 border-t border-border pt-6 text-center text-[13px] text-muted-foreground">
        حساب دارید؟{" "}
        <Link href="/login" className="mr-1 font-medium text-primary">
          ورود به واحدبان
        </Link>
      </p>
    </AuthFrame>
  );
}

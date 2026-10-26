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
          {first ? "به هم‌خانه خوش آمدید." : "همسایه جدید، خوش آمدید."}
        </h1>
        <p className="mt-3 text-[13px] leading-7 text-muted-foreground">
          {first
            ? "با شماره تلفن حساب مدیر را بسازید و مدیریت ساختمان را شروع کنید."
            : "شماره تلفن را وارد کنید. اگر مدیر همین شماره را ساخته باشد، به همان حساب وصل می‌شوید."}
        </p>
      </div>
      <RegisterForm isFirstUser={first} units={units} />
      {googleSignInEnabled() && <GoogleOption />}
      <p className="mt-8 border-t border-border pt-6 text-center text-[13px] text-muted-foreground">
        حساب دارید؟{" "}
        <Link href="/login" className="mr-1 font-medium text-primary">
          ورود به هم‌خانه
        </Link>
      </p>
    </AuthFrame>
  );
}

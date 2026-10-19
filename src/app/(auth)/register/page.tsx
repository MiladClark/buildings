import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthFrame } from "@/components/auth/auth-frame";
import { countUsers } from "@/lib/queries/dashboard";
import { connection } from "next/server";
export default async function RegisterPage() {
  await connection();
  const first = (await countUsers()) === 0;
  return (
    <AuthFrame>
      <div className="mb-8">
        <h2 className="text-[27px] font-bold">
          {first ? "به هم‌خانه خوش آمدید." : "همسایه جدید، خوش آمدید."}
        </h2>
        <p className="mt-3 text-xs leading-7 text-muted-foreground">
          {first
            ? "حساب مدیر را بسازید و مدیریت ساختمان را شروع کنید."
            : "حساب بسازید؛ مدیر ساختمان، واحد شما را به حسابتان متصل می‌کند."}
        </p>
      </div>
      <RegisterForm isFirstUser={first} />
      <p className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        حساب دارید؟{" "}
        <Link href="/login" className="mr-1 font-medium text-primary">
          ورود به هم‌خانه
        </Link>
      </p>
    </AuthFrame>
  );
}

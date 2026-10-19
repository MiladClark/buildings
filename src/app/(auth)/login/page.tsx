import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { AuthFrame } from "@/components/auth/auth-frame";
export default function LoginPage() {
  return (
    <AuthFrame>
      <div className="mb-8">
        <h2 className="text-[27px] font-bold">خوش برگشتید.</h2>
        <p className="mt-3 text-xs leading-7 text-muted-foreground">
          برای دیدن حساب‌وکتاب ساختمان، وارد حساب خود شوید.
        </p>
      </div>
      <LoginForm />
      <p className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        هنوز حساب ندارید؟{" "}
        <Link href="/register" className="mr-1 font-medium text-primary">
          ساخت حساب کاربری
        </Link>
      </p>
    </AuthFrame>
  );
}

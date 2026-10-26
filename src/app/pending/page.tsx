import { redirect } from "next/navigation";
import Link from "next/link";
import { Buildings } from "@phosphor-icons/react/dist/ssr";
import { getSession, getMembershipForUser } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
export default async function PendingPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (await getMembershipForUser(s.user.id)) redirect("/");
  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <div className="panel max-w-md p-8 text-center">
        <Buildings
          size={38}
          className="mx-auto mb-5 text-primary"
          weight="duotone"
        />
        <h1 className="text-xl font-bold">حساب شما آماده است.</h1>
        <p className="my-5 text-sm leading-8 text-muted-foreground">
          اگر مدیر شماره شما را از قبل نساخته باشد، از او بخواهید در «حساب
          ساکنان» حساب را به واحدتان وصل کند. بعد از اتصال، فیش‌ها اینجا در
          دسترس است.
        </p>
        <Link href="/" className="mb-5 block text-xs text-primary">
          بررسی دوباره اتصال واحد
        </Link>
        <SignOutButton />
      </div>
    </main>
  );
}

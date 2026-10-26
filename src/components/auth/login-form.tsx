"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { loginToEmail } from "@/lib/auth/phone";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    let email = "";
    try {
      email = loginToEmail(String(form.get("identifier") ?? ""));
    } catch (error) {
      setLoading(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "شماره تلفن را به صورت ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.",
      );
      return;
    }

    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        toast.error(
          error.status === 403
            ? "آدرس ورود معتبر نیست؛ صفحه را بازخوانی کنید و دوباره وارد شوید."
            : "ورود ناموفق بود. شماره یا رمز را بررسی کنید.",
        );
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      toast.error("ارتباط با سامانه برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="space-y-2">
        <Label htmlFor="identifier">شماره تلفن یا ایمیل</Label>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          dir="ltr"
          required
          autoComplete="username"
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">رمز عبور</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "لطفاً صبر کنید..." : "ورود"}
      </Button>
    </form>
  );
}

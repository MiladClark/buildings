"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { linkFirstManager } from "@/lib/actions/building";

export function RegisterForm({ isFirstUser }: { isFirstUser: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name"));
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    try {
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name,
      });
      if (error || !data?.user) {
        setLoading(false);
        toast.error("ثبت‌نام انجام نشد. شاید این ایمیل قبلاً ثبت شده باشد.");
        return;
      }

      if (isFirstUser) {
        await linkFirstManager(data.user.id);
      }

      setLoading(false);
      toast.success("حساب ساخته شد.");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("ثبت‌نام کامل نشد. ارتباط با سامانه را بررسی کنید.");
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
        <Label htmlFor="name">نام</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">ایمیل</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">رمز عبور (حداقل ۸ کاراکتر)</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading
          ? "در حال ساخت حساب..."
          : isFirstUser
            ? "ساخت حساب مدیر"
            : "ثبت‌نام"}
      </Button>
    </form>
  );
}

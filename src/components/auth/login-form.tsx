"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("password"));

    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        toast.error(
          error.status === 403
            ? "آدرس ورود معتبر نیست؛ صفحه را بازخوانی کنید و دوباره وارد شوید."
            : "ورود ناموفق بود. ایمیل یا رمز را بررسی کنید.",
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

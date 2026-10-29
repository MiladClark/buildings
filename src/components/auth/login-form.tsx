"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import {
  englishPassword,
  latinDigits,
  writeLatinDigits,
} from "@/lib/auth/phone";

export function LoginForm({
  connectGoogle = false,
}: {
  connectGoogle?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    let password: string;
    try {
      password = englishPassword(String(form.get("password") ?? ""));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "رمز عبور باید فقط با حروف انگلیسی باشد.",
      );
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/sign-in/identifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: latinDigits(String(form.get("identifier") ?? "")),
          password,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        toast.error(
          response.status === 403
            ? "آدرس ورود معتبر نیست؛ صفحه را بازخوانی کنید و دوباره وارد شوید."
            : response.status === 429
              ? "کمی صبر کنید و دوباره تلاش کنید."
              : body?.message || "ورود ناموفق بود. شماره یا رمز را بررسی کنید.",
        );
        return;
      }
      if (connectGoogle) {
        const result = await authClient.linkSocial({
          provider: "google",
          callbackURL: "/login?connected=1",
          errorCallbackURL: "/login?error=google",
        });
        if (result.error) {
          router.replace("/login?connect=google");
          router.refresh();
          toast.error("ورود انجام شد؛ برای اتصال گوگل دوباره تلاش کنید.");
        }
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
          onInput={(event) => writeLatinDigits(event.currentTarget)}
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
          onInput={(event) => writeLatinDigits(event.currentTarget)}
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "لطفاً صبر کنید..." : "ورود"}
      </Button>
    </form>
  );
}

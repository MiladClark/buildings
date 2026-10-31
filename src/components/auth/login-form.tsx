"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/auth/floating-field";
import { authClient } from "@/lib/auth-client";
import "./login-form.css";
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
      className="login-form mx-auto flex w-full max-w-sm flex-col gap-6 pt-2 text-right"
    >
      <FloatingInput
        label="شماره تلفن یا ایمیل"
        id="identifier"
        name="identifier"
        type="text"
        dir="ltr"
        required
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
        onInput={(event) => writeLatinDigits(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          const password =
            event.currentTarget.form?.elements.namedItem("password");
          if (password instanceof HTMLInputElement) {
            event.preventDefault();
            password.focus();
          }
        }}
      />
      <FloatingInput
        label="رمز عبور"
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        onInput={(event) => writeLatinDigits(event.currentTarget)}
      />
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "لطفاً صبر کنید..." : "ورود"}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { GoogleLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function GoogleButton({ link = false }: { link?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setBusy(true);
    setError("");
    try {
      const options = {
        provider: "google" as const,
        callbackURL: "/login?connected=1",
        errorCallbackURL: "/login?error=google",
      };
      const result = link
        ? await authClient.linkSocial(options)
        : await authClient.signIn.social(options);
      if (result.error) throw new Error();
    } catch {
      setError("ارتباط با گوگل برقرار نشد. دوباره تلاش کنید.");
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-3"
        disabled={busy}
        onClick={start}
      >
        <GoogleLogo size={20} weight="bold" aria-hidden="true" />
        {busy
          ? "در حال رفتن به گوگل…"
          : link
            ? "اتصال حساب گوگل"
            : "ادامه با گوگل"}
      </Button>
      {error && (
        <p role="alert" className="text-[13px] leading-7 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function GoogleOption() {
  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        یا
        <span className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />
    </div>
  );
}

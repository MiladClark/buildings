"use client";

import { useState } from "react";
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
        <GoogleMark />
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

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.5l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1c.9-2.8 3.5-4.8 6.6-4.8z"
      />
    </svg>
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

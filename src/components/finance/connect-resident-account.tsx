"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";

export function ConnectResidentAccount() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    let connected = false;
    try {
      const response = await fetch("/api/auth/resident/connect-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.get("phone"),
          password: form.get("password"),
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(
          response.status === 429
            ? "کمی صبر کنید و دوباره تلاش کنید."
            : result.message || "اتصال حساب انجام نشد.",
        );
        return;
      }
      connected = true;
      // Refresh both the account identity and the navigation after reconciliation.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/resident");
    } catch {
      setError("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      if (!connected) setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-5 border-t border-border pt-5">
      <div>
        <h3 className="text-sm font-semibold">اتصال حساب شماره‌ایِ واحد من</h3>
        <p className="mt-2 text-xs leading-7 text-muted-foreground">
          اگر قبلاً برای واحدتان حساب جدا ساخته‌اید، شماره و رمز همان حساب را
          وارد کنید. اگر هنوز فعال نشده، رمز لازم نیست. سوابق واحد حفظ می‌شوند و
          شماره و ایمیل، هر دو وارد همین حساب می‌شوند. پس از اتصال، رمز مدیریت
          برای ورود با شماره هم استفاده می‌شود؛ اگر مدیریت رمز ندارد، رمز حساب
          واحد حفظ می‌شود.
        </p>
      </div>
      <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
        <PhoneInput
          name="phone"
          label="شماره حساب واحد من"
          required
          autoComplete="username"
        />
        <Input
          name="password"
          label="رمز فعلی حساب واحد"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          maxLength={200}
        />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy} variant="outline">
            <Link2 size={16} aria-hidden="true" />
            {busy ? "در حال اتصال…" : "اتصال حساب و نمایش واحد من"}
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-xs leading-7 text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

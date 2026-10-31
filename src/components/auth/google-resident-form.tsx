"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";

export function GoogleResidentForm({
  units,
  defaultFirstName = "",
  defaultLastName = "",
}: {
  units: { id: string; label: string }[];
  defaultFirstName?: string;
  defaultLastName?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setUsePassword(false);
    const form = new FormData(event.currentTarget);
    let entered = false;
    try {
      const response = await fetch("/api/auth/resident/complete-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          phone: form.get("phone"),
          unitId: form.get("unitId"),
        }),
      });
      const result = (await response.json()) as {
        message?: string;
        code?: string;
      };
      if (!response.ok) {
        setError(
          response.status === 429
            ? "کمی صبر کنید و دوباره تلاش کنید."
            : result.message || "اتصال انجام نشد. دوباره تلاش کنید.",
        );
        setUsePassword(result.code === "USE_PASSWORD");
        return;
      }
      entered = true;
      // Full navigation applies the rotated session cookies before the app loads.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
      return;
    } catch {
      setError("ارتباط با سامانه برقرار نشد. دوباره تلاش کنید.");
    } finally {
      if (!entered) setBusy(false);
    }
  }
  async function changeAccount(password = false) {
    setBusy(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error();
      router.replace(password ? "/login?connect=google" : "/login");
      router.refresh();
    } catch {
      setError("خروج انجام نشد. دوباره تلاش کنید.");
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-field">
            <Label htmlFor="google-first-name">نام</Label>
            <Input
              id="google-first-name"
              name="firstName"
              autoComplete="given-name"
              defaultValue={defaultFirstName}
              maxLength={60}
            />
          </div>
          <div className="form-field">
            <Label htmlFor="google-last-name">نام خانوادگی</Label>
            <Input
              id="google-last-name"
              name="lastName"
              autoComplete="family-name"
              defaultValue={defaultLastName}
              maxLength={60}
            />
          </div>
        </div>
        <div className="form-field">
          <Label htmlFor="google-phone">شماره تلفن</Label>
          <PhoneInput id="google-phone" name="phone" required />
        </div>
        <div className="form-field">
          <Label htmlFor="google-unit">واحد شما</Label>
          <Select id="google-unit" name="unitId" required>
            <option value="">واحد را انتخاب کنید</option>
            {units.map((item) => (
              <option key={item.id} value={item.id}>
                واحد {item.label}
              </option>
            ))}
          </Select>
        </div>
        {error && (
          <p role="alert" className="text-[13px] leading-7 text-destructive">
            {error}
          </p>
        )}
        {units.length === 0 && (
          <p className="text-[13px] leading-7 text-muted-foreground">
            هنوز واحدی ثبت نشده است. از مدیر بخواهید ابتدا واحد و شماره شما را
            ثبت کند.
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={busy || units.length === 0}
        >
          {busy ? "لطفاً صبر کنید…" : "ورود به حساب"}
        </Button>
      </form>
      {usePassword && (
        <Button
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => changeAccount(true)}
        >
          ورود با رمز و اتصال گوگل
        </Button>
      )}
      <Button
        variant="ghost"
        className="w-full text-muted-foreground"
        disabled={busy}
        onClick={() => changeAccount()}
      >
        خروج و انتخاب حساب دیگر
      </Button>
    </div>
  );
}

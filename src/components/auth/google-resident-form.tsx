"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";

export function GoogleResidentForm({
  units,
}: {
  units: { id: string; label: string }[];
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
    try {
      const response = await fetch("/api/auth/resident/complete-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.get("phone"),
          unitId: form.get("unitId"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          response.status === 429
            ? "کمی صبر کنید و دوباره تلاش کنید."
            : result.message || "اتصال انجام نشد. دوباره تلاش کنید.",
        );
        setUsePassword(result.code === "USE_PASSWORD");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("ارتباط با سامانه برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
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
        <div className="space-y-2">
          <Label htmlFor="google-phone">شماره تلفن</Label>
          <Input
            id="google-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
            required
            maxLength={40}
          />
        </div>
        <div className="space-y-2">
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
          {busy ? "لطفاً صبر کنید…" : "اتصال به حساب واحد"}
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

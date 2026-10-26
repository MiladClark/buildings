"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { registrationUnitNumber } from "@/lib/auth/phone";
import { registerWithPhone } from "@/lib/actions/resident-accounts";

export function RegisterForm({
  isFirstUser,
  units,
}: {
  isFirstUser: boolean;
  units: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const result = await registerWithPhone({
      phone: String(form.get("phone") ?? ""),
      password: String(form.get("password") ?? ""),
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      unitId: String(form.get("unitId") ?? ""),
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("حساب ساخته شد.");
    router.push("/");
    router.refresh();
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">نام</Label>
          <Input id="firstName" name="firstName" autoComplete="given-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">نام خانوادگی</Label>
          <Input id="lastName" name="lastName" autoComplete="family-name" />
        </div>
      </div>
      <div className={isFirstUser ? "space-y-2" : "grid grid-cols-2 gap-3"}>
        <div className="space-y-2">
          <Label htmlFor="phone">شماره تلفن</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            required
            autoComplete="tel"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
          />
        </div>
        {!isFirstUser && (
          <div className="space-y-2">
            <Label htmlFor="unitId">واحد</Label>
            <Select id="unitId" name="unitId" required>
              <option value="">انتخاب</option>
              {units.map((item) => {
                const number = registrationUnitNumber(item.label);
                return (
                  <option key={item.id} value={item.id}>
                    {number?.toLocaleString("fa-IR")}
                  </option>
                );
              })}
            </Select>
          </div>
        )}
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

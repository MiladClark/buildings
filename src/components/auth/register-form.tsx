"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  FloatingInput,
  FloatingSelect,
} from "@/components/auth/floating-field";
import { Button } from "@/components/ui/button";
import {
  englishPassword,
  latinDigits,
  registrationUnitNumber,
  writeLatinDigits,
} from "@/lib/auth/phone";
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
    const result = await registerWithPhone({
      phone: latinDigits(String(form.get("phone") ?? "")),
      password,
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
      className="flex w-full max-w-sm flex-col gap-5 pt-2"
    >
      <div className="grid grid-cols-2 gap-3">
        <FloatingInput
          id="firstName"
          name="firstName"
          label="نام"
          autoComplete="given-name"
          enterKeyHint="next"
        />
        <FloatingInput
          id="lastName"
          name="lastName"
          label="نام خانوادگی"
          autoComplete="family-name"
          enterKeyHint="next"
        />
      </div>
      <div className={isFirstUser ? undefined : "grid grid-cols-2 gap-3"}>
        <FloatingInput
          id="phone"
          name="phone"
          label="شماره تلفن"
          type="tel"
          inputMode="tel"
          dir="ltr"
          required
          autoComplete="tel"
          enterKeyHint="next"
          onInput={(event) => writeLatinDigits(event.currentTarget)}
        />
        {!isFirstUser && (
          <FloatingSelect id="unitId" name="unitId" label="واحد" required>
            <option value="">انتخاب</option>
            {units.map((item) => {
              const number = registrationUnitNumber(item.label);
              return (
                <option key={item.id} value={item.id}>
                  {number?.toLocaleString("fa-IR")}
                </option>
              );
            })}
          </FloatingSelect>
        )}
      </div>
      <FloatingInput
        id="password"
        name="password"
        label="رمز عبور (حداقل ۸ کاراکتر)"
        type="password"
        minLength={8}
        required
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        onInput={(event) => writeLatinDigits(event.currentTarget)}
      />
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

"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { writeIranMobile } from "@/lib/auth/phone";

/** A local Iranian mobile number, accepting pasted international formats too. */
export function PhoneInput({
  onChange,
  onInvalid,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      type="tel"
      inputMode="tel"
      dir="ltr"
      autoComplete="tel"
      placeholder="09123456789"
      pattern="09[0-9]{9}"
      title="شماره موبایل ۱۱ رقمی، مانند 09123456789"
      {...props}
      onChange={(event) => {
        writeIranMobile(event.currentTarget);
        event.currentTarget.setCustomValidity("");
        onChange?.(event);
      }}
      onInvalid={(event) => {
        event.currentTarget.setCustomValidity(
          "شماره موبایل ۱۱ رقمی وارد کنید؛ مانند 09123456789.",
        );
        onInvalid?.(event);
      }}
    />
  );
}

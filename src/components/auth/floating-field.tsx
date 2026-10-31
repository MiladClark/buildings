"use client";

import { useId, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";

/** Native labels share the app's floating treatment, including autofill and reset. */
export function FloatingInput({
  id,
  label,
  ...props
}: ComponentProps<typeof Input> & { label: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const Control = props.type === "tel" ? PhoneInput : Input;
  return (
    <div className="form-field">
      <label htmlFor={fieldId}>{label}</label>
      <Control {...props} id={fieldId} />
    </div>
  );
}

export function FloatingSelect({
  id,
  label,
  ...props
}: ComponentProps<typeof Select> & { label: string }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="form-field">
      <label htmlFor={fieldId}>{label}</label>
      <Select
        {...props}
        id={fieldId}
        aria-label={props["aria-label"] ?? label}
      />
    </div>
  );
}

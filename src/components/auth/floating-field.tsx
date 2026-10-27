"use client";

import { useState, type ComponentProps } from "react";
import { Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function FloatingChrome({
  id,
  label,
  active,
  filled,
  check = false,
  children,
}: {
  id: string;
  label: string;
  active: boolean;
  filled: boolean;
  check?: boolean;
  children: React.ReactNode;
}) {
  const float = active || filled;
  return (
    <div className="relative">
      {children}
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute right-3 bg-background px-1 font-medium transition-all duration-200 ease-out",
          float
            ? "top-0 -translate-y-1/2 text-[11px]"
            : "top-1/2 -translate-y-1/2 text-[13px]",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </label>
      {check && filled && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-primary"
        >
          <Check size={16} strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}

export function FloatingInput({
  id,
  label,
  className,
  defaultValue,
  onChange,
  ...props
}: ComponentProps<typeof Input> & { label: string }) {
  const [focused, setFocused] = useState(false);
  const [filled, setFilled] = useState(
    String(defaultValue ?? props.value ?? "").trim().length > 0,
  );
  return (
    <FloatingChrome
      id={id ?? ""}
      label={label}
      active={focused}
      filled={filled}
      check
    >
      <Input
        {...props}
        id={id}
        placeholder=" "
        defaultValue={defaultValue}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onChange={(event) => {
          setFilled(event.target.value.trim().length > 0);
          onChange?.(event);
        }}
        className={cn("w-full", filled && "pl-9", className)}
      />
    </FloatingChrome>
  );
}

export function FloatingSelect({
  id,
  label,
  onValueChange,
  ...props
}: ComponentProps<typeof Select> & { label: string }) {
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [filled, setFilled] = useState(
    String(props.defaultValue ?? props.value ?? "").length > 0,
  );
  return (
    <FloatingChrome
      id={id ?? ""}
      label={label}
      active={focused || open}
      filled={filled}
    >
      <div
        className="relative"
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false);
        }}
      >
        <Select
          {...props}
          id={id}
          hideEmptyValue
          className={cn("w-full", props.className)}
          onOpenChange={(next) => {
            setOpen(next);
            props.onOpenChange?.(next);
          }}
          onValueChange={(next) => {
            setFilled(next.length > 0);
            onValueChange?.(next);
          }}
        />
      </div>
    </FloatingChrome>
  );
}

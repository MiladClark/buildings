import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  placeholder = " ",
  label,
  ...props
}: React.ComponentProps<"input"> & { label?: string }) {
  const control = (
    <input
      type={type}
      placeholder={placeholder}
      className={cn(
        "form-control flex w-full placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
  return label ? (
    <label className="form-field w-full min-w-0">
      <span>{label}</span>
      {control}
    </label>
  ) : (
    control
  );
}

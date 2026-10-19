import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "form-control flex w-full placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

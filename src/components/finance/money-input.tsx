import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { toToman } from "@/lib/format/money";

/** Form fields accept toman; defaults arrive in the existing ledger unit. */
export function MoneyInput({
  defaultRial,
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "inputMode" | "defaultValue"> & {
  defaultRial?: number | null;
}) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      dir="ltr"
      maxLength={30}
      defaultValue={
        defaultRial == null
          ? ""
          : toToman(defaultRial).toLocaleString("en-US", {
              maximumFractionDigits: 1,
            })
      }
    />
  );
}

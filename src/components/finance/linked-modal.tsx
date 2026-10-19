"use client";
import type { ComponentProps } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FormModal } from "./forms";

/** Close a deep-linked dialog by clearing its URL as well as its visual state,
 * so following the same workflow link again can open it reliably. */
export function LinkedFormModal({
  returnHref,
  ...props
}: Omit<ComponentProps<typeof FormModal>, "onClose"> & {
  returnHref?: string;
}) {
  const router = useRouter(),
    path = usePathname();
  return (
    <FormModal
      {...props}
      onClose={() => {
        if (props.initialOpen)
          router.replace(returnHref ?? path, { scroll: false });
      }}
    />
  );
}

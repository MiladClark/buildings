"use client";

import { useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CircleHelp } from "lucide-react";

export function FieldHint({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={`راهنمای ${label}`}
            onClick={() => setOpen(true)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:text-primary"
          >
            <CircleHelp size={17} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            dir="rtl"
            side="top"
            sideOffset={8}
            collisionPadding={16}
            className="z-[80] max-w-[min(18rem,calc(100vw-32px))] rounded-xl border border-border bg-card px-3.5 py-3 text-xs leading-6 text-foreground shadow-lg"
          >
            {children}
            <Tooltip.Arrow className="fill-card" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

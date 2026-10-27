"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      toast.error("کپی انجام نشد؛ مقدار را به‌صورت دستی انتخاب کنید.");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
      aria-label={`کپی ${label}`}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "کپی شد" : "کپی"}
    </button>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  clearBuildingCache,
  reloadBuildingCache,
} from "@/lib/actions/cache";

export function CacheControls() {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  function reload() {
    setConfirming(false);
    start(async () => {
      try {
        await reloadBuildingCache();
        toast.success("کش ساختمان دوباره بارگذاری شد.");
      } catch {
        toast.error("بارگذاری کش انجام نشد.");
      }
    });
  }

  function clear() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    start(async () => {
      try {
        await clearBuildingCache();
        toast.success("کش ساختمان پاک شد و از پایگاه تازه ساخته می‌شود.");
      } catch {
        toast.error("پاک کردن کش انجام نشد.");
      }
    });
  }

  return (
    <div className="flex items-center">
      <button
        type="button"
        aria-label="بارگذاری مجدد کش"
        title="بارگذاری مجدد کش"
        disabled={pending}
        onClick={reload}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-50"
      >
        <RefreshCw size={19} />
      </button>
      <button
        type="button"
        aria-label={confirming ? "تأیید پاک کردن کش" : "پاک کردن کش"}
        title={confirming ? "برای پاک کردن دوباره بزنید" : "پاک کردن کش"}
        disabled={pending}
        onClick={clear}
        className={`rounded-lg p-2 disabled:opacity-50 ${confirming ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted hover:text-primary"}`}
      >
        <Trash2 size={19} />
      </button>
    </div>
  );
}

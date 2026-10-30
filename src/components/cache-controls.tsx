"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { clearBuildingCache, reloadBuildingCache } from "@/lib/actions/cache";

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
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="بارگذاری مجدد کش"
        title="بارگذاری مجدد کش"
        disabled={pending}
        onClick={reload}
        className="text-muted-foreground hover:text-primary"
      >
        <RefreshCw size={19} />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={confirming ? "تأیید پاک کردن کش" : "پاک کردن کش"}
        title={confirming ? "برای پاک کردن دوباره بزنید" : "پاک کردن کش"}
        disabled={pending}
        onClick={clear}
        className={
          confirming
            ? "bg-destructive/10 text-destructive"
            : "text-muted-foreground hover:text-primary"
        }
      >
        <Trash2 size={19} />
      </Button>
    </div>
  );
}

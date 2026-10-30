"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const hintKey = "vahedban-pwa-hint";

function iosDevice() {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

function installedDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .catch(() => {});
  }, []);

  return null;
}

function subscribeHint() {
  return () => {};
}

function hintVisible() {
  try {
    if (localStorage.getItem(hintKey) === "dismissed") return false;
  } catch {
    return false;
  }
  return !installedDisplay() && iosDevice();
}

export function PwaInstallHint() {
  const eligible = useSyncExternalStore(
    subscribeHint,
    hintVisible,
    () => false,
  );
  const [closed, setClosed] = useState(false);

  if (!eligible || closed) return null;

  return (
    <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 lg:hidden">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Share size={18} />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-6">
          برای نصب واحدبان، دکمهٔ اشتراک‌گذاری را بزنید و «افزودن به صفحهٔ اصلی»
          را انتخاب کنید.
        </p>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-muted-foreground"
          aria-label="بستن راهنمای نصب"
          onClick={() => {
            try {
              localStorage.setItem(hintKey, "dismissed");
            } catch {
              // The hint can stay dismissed for this visit only.
            }
            setClosed(true);
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

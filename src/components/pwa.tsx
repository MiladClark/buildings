"use client";

import Image from "next/image";
import { Download } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const displayQueries = [
  "(display-mode: standalone)",
  "(display-mode: fullscreen)",
  "(display-mode: minimal-ui)",
];

function iosDevice() {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

function installedDisplay() {
  return (
    displayQueries.some((query) => window.matchMedia(query).matches) ||
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

function subscribeDisplay(onChange: () => void) {
  const queries = [...displayQueries, "(max-width: 767px)"].map((query) =>
    window.matchMedia(query),
  );
  queries.forEach((query) => query.addEventListener("change", onChange));
  window.addEventListener("pageshow", onChange);
  return () => {
    queries.forEach((query) => query.removeEventListener("change", onChange));
    window.removeEventListener("pageshow", onChange);
  };
}

function installDisplay() {
  if (installedDisplay() || !window.matchMedia("(max-width: 767px)").matches)
    return "hidden";
  return iosDevice() ? "ios" : "other";
}

export function PwaInstallCard() {
  const display = useSyncExternalStore(
    subscribeDisplay,
    installDisplay,
    () => "hidden",
  );
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault();
      promptRef.current = event as InstallPromptEvent;
      setShowGuide(false);
    }
    function onInstalled() {
      promptRef.current = null;
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    const prompt = promptRef.current;
    if (!prompt) {
      setShowGuide((visible) => !visible);
      return;
    }
    promptRef.current = null;
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setShowGuide(true);
    } finally {
      setInstalling(false);
    }
  }

  if (display === "hidden" || installed) return null;

  return (
    <div className="mt-6 rounded-2xl bg-secondary/70 text-right md:hidden">
      <button
        type="button"
        onClick={install}
        disabled={installing}
        aria-expanded={showGuide}
        aria-controls="pwa-install-guide"
        className="flex min-h-20 w-full items-center gap-3 rounded-2xl p-4 text-right transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-60"
      >
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-xl"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">نصب نسخه موبایل</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {installing ? "در حال نصب…" : "دسترسی سریع به واحدبان از صفحهٔ اصلی"}
          </span>
        </span>
        <Download
          size={20}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
      </button>
      <div id="pwa-install-guide" hidden={!showGuide}>
        <p
          className="px-4 pb-4 text-[13px] leading-7 text-muted-foreground"
          role="status"
        >
          {display === "ios"
            ? "در مرورگر Safari، دکمهٔ اشتراک‌گذاری (Share) را بزنید، «افزودن به صفحهٔ اصلی» (Add to Home Screen) و سپس «افزودن» (Add) را انتخاب کنید."
            : "از منوی مرورگر، «نصب برنامه» (Install app) یا «افزودن به صفحهٔ اصلی» (Add to Home screen) را انتخاب کنید. اگر این گزینه را نمی‌بینید، صفحه را در مرورگر Chrome باز کنید."}
        </p>
      </div>
    </div>
  );
}

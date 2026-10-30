"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  subscribePush,
  unsubscribePush,
  testOwnPush,
  removePushDevice,
} from "@/lib/actions/notifications";
import { ActionButton } from "@/components/finance/forms";

export function PushDevice({
  publicKey,
  devices,
}: {
  publicKey: string;
  devices: { id: string; name: string; endpoint: string }[];
}) {
  const [state, setState] = useState("checking"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ios =
        /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
      const installed =
        matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      let next = "off";
      if (ios && !installed) next = "install";
      else if (
        !window.isSecureContext ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        const expected = Uint8Array.from(
          atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        );
        const matchingKey =
          !sub?.options.applicationServerKey ||
          Array.from(
            new Uint8Array(sub.options.applicationServerKey),
          ).join() === Array.from(expected).join();
        if (
          sub &&
          matchingKey &&
          devices.some((d) => d.endpoint === sub.endpoint)
        )
          next = "on";
      }
      if (!cancelled) setState(next);
    })().catch(() => {
      if (!cancelled) setState("off");
    });
    return () => {
      cancelled = true;
    };
  }, [devices, publicKey]);
  async function enable() {
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const reg = await navigator.serviceWorker.ready;
      const bytes = Uint8Array.from(
        atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      );
      let sub = await reg.pushManager.getSubscription();
      if (
        sub &&
        sub.options.applicationServerKey &&
        Array.from(new Uint8Array(sub.options.applicationServerKey)).join() !==
          Array.from(bytes).join()
      ) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes.buffer,
      });
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth)
        throw new Error("کلید دستگاه دریافت نشد.");
      const name = /iPhone|iPad|iPod/.test(navigator.userAgent)
        ? "آیفون / آیپد"
        : /Android/.test(navigator.userAgent)
          ? "گوشی اندروید"
          : "مرورگر رایانه";
      await subscribePush({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        deviceName: name,
      });
      setState("on");
      toast.success("اعلان این دستگاه فعال شد.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فعال‌سازی اعلان انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      router.refresh();
    } catch {
      setError("غیرفعال‌سازی انجام نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Bell size={19} className="mt-0.5 text-muted-foreground" />
        <div>
          <h2 className="panel-title">اعلان روی این دستگاه</h2>
          <p className="mt-2 text-xs leading-7 text-muted-foreground">
            با اجازه شما، پیام‌ها حتی وقتی واحدبان بسته است نمایش داده می‌شوند.
          </p>
        </div>
      </div>
      {state === "install" ? (
        <p className="text-xs leading-7">
          در آیفون، واحدبان را از منوی اشتراک‌گذاری به صفحه اصلی اضافه کنید؛ سپس
          از نسخه نصب‌شده اعلان را فعال کنید.
        </p>
      ) : state === "unsupported" ? (
        <p className="text-xs leading-7">
          این مرورگر امکان دریافت پوش ندارد. خبرها همچنان در صندوق اعلان‌های شما
          هستند. برای گوشی از نسخه نصب‌شده و آدرس امن سایت استفاده کنید.
        </p>
      ) : state === "denied" ? (
        <p className="text-xs leading-7">
          اجازه اعلان در تنظیمات مرورگر بسته است؛ برای فعال‌سازی، مجوز اعلان این
          سایت را باز کنید.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {state === "on" ? (
            <>
              <span className="status status-success">فعال روی این دستگاه</span>
              <Button variant="outline" onClick={disable} disabled={busy}>
                <BellOff size={15} />
                غیرفعال‌کردن این دستگاه
              </Button>
              <ActionButton
                action={testOwnPush}
                success="اعلان آزمایشی در صف ارسال است؛ ساعت سکوت نیز رعایت می‌شود."
              >
                اعلان آزمایشی
              </ActionButton>
            </>
          ) : (
            <Button onClick={enable} disabled={busy || state === "checking"}>
              {busy
                ? "در حال اتصال…"
                : state === "checking"
                  ? "در حال بررسی…"
                  : "فعال‌کردن اعلان این دستگاه"}
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive leading-7">
          {error}
        </p>
      )}
      {devices.length > 0 && (
        <details className="border-t border-border pt-4">
          <summary className="text-xs text-muted-foreground">
            دستگاه‌های دریافت اعلان ({devices.length.toLocaleString("fa-IR")})
          </summary>
          <ul className="mt-3 divide-y divide-border">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between py-3 text-xs"
              >
                <span>{d.name}</span>
                <ActionButton
                  variant="ghost"
                  action={() => removePushDevice(d.id)}
                  success="دریافت اعلان این دستگاه لغو شد."
                >
                  لغو دریافت
                </ActionButton>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

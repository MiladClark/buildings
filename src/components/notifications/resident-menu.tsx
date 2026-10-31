"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  LoaderCircle,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationRead } from "@/lib/actions/notifications";
import type { NotificationPreview } from "@/lib/notifications/inbox";

const dateFormat = new Intl.DateTimeFormat("fa-IR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ResidentNotificationMenu({
  children,
  count,
  onCountChange,
  role = "resident",
}: {
  children: ReactNode;
  count: number;
  onCountChange: (count: number) => void;
  role?: "manager" | "resident";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [data, setData] = useState<NotificationPreview | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  const reading = useRef(false);

  const refresh = useCallback(async () => {
    if (reading.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch("/api/notifications/inbox", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("fetch failed");
      const next: NotificationPreview = await response.json();
      if (controller.signal.aborted) return;
      setData(next);
      onCountChange(next.unreadCount);
      setError("");
    } catch {
      if (!controller.signal.aborted)
        setError("اعلان‌ها دریافت نشد. دوباره تلاش کنید.");
    }
  }, [onCountChange]);

  useEffect(() => {
    if (!open) return;
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 60000);
    const update = () => void refresh();
    window.addEventListener("focus", update);
    window.addEventListener("notifications-updated", update);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      request.current?.abort();
      window.removeEventListener("focus", update);
      window.removeEventListener("notifications-updated", update);
    };
  }, [open, refresh]);

  async function read(id?: string, href?: string) {
    if (reading.current) return;
    reading.current = true;
    request.current?.abort();
    setPending(true);
    setError("");
    try {
      await markNotificationRead(id);
      if (data) {
        const unreadCount = id ? Math.max(0, data.unreadCount - 1) : 0;
        setData({
          all: data.all.map((notice) =>
            !id || notice.id === id ? { ...notice, read: true } : notice,
          ),
          unread: id ? data.unread.filter((notice) => notice.id !== id) : [],
          unreadCount,
        });
        onCountChange(unreadCount);
      }
      // Refresh both lists: an older unread notice may enter the preview.
      reading.current = false;
      window.dispatchEvent(new Event("notifications-updated"));
      if (href) {
        setOpen(false);
        router.push(href);
      }
    } catch {
      setError("ثبت خواندن اعلان انجام نشد. دوباره تلاش کنید.");
    } finally {
      reading.current = false;
      setPending(false);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          dir="rtl"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-label="اعلان‌های من"
          className="z-50 flex max-h-[min(560px,var(--radix-popover-content-available-height))] w-[min(390px,calc(100vw-24px),var(--radix-popover-content-available-width))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl outline-none"
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">اعلان‌ها</h2>
              <p
                className="mt-1 text-[11px] text-muted-foreground"
                aria-live="polite"
              >
                {count
                  ? `${count.toLocaleString("fa-IR")} اعلان خوانده‌نشده`
                  : "همه اعلان‌ها را خوانده‌اید"}
              </p>
            </div>
            <Button asChild size="icon" variant="ghost">
              <Link
                href={`/${role}/notifications?tab=preferences`}
                aria-label="تنظیمات اعلان‌ها"
                title="تنظیمات اعلان‌ها"
                onClick={() => setOpen(false)}
              >
                <Settings2 aria-hidden="true" />
              </Link>
            </Button>
            <Popover.Close asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label="بستن اعلان‌ها"
                title="بستن"
              >
                <X aria-hidden="true" />
              </Button>
            </Popover.Close>
          </header>
          <Tabs.Root
            value={tab}
            onValueChange={setTab}
            dir="rtl"
            className="flex min-h-0 flex-1 flex-col"
          >
            <Tabs.List
              aria-label="فیلتر اعلان‌ها"
              className="mx-4 mt-3 grid shrink-0 grid-cols-2 rounded-lg bg-muted/60 p-1"
            >
              {[
                ["all", "همه"],
                ["unread", "خوانده‌نشده"],
              ].map(([value, label]) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  {label}
                  {value === "unread" && count > 0 && (
                    <span className="rounded-md bg-primary/15 px-1.5 text-[10px] text-primary">
                      {count.toLocaleString("fa-IR")}
                    </span>
                  )}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <div role="status" className="shrink-0 px-4">
              {error && (
                <div className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs text-destructive">
                  <span>{error}</span>
                  <Button variant="outline" onClick={() => void refresh()}>
                    تلاش دوباره
                  </Button>
                </div>
              )}
            </div>
            {["all", "unread"].map((value) => {
              const items = data?.[value as "all" | "unread"];
              return (
                <Tabs.Content
                  key={value}
                  value={value}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=inactive]:hidden"
                  style={{ scrollbarGutter: "stable" }}
                >
                  {!data && !error ? (
                    <div
                      role="status"
                      className="flex min-h-48 items-center justify-center gap-2 text-xs text-muted-foreground"
                    >
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                      در حال دریافت اعلان‌ها…
                    </div>
                  ) : null}
                  {items?.length === 0 && (
                    <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center">
                      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {value === "unread" ? (
                          <CheckCheck size={20} />
                        ) : (
                          <Bell size={20} />
                        )}
                      </span>
                      <p className="text-sm font-medium">
                        {value === "unread"
                          ? "اعلان خوانده‌نشده‌ای ندارید"
                          : "هنوز اعلانی ندارید"}
                      </p>
                      <p className="text-xs leading-6 text-muted-foreground">
                        {value === "unread"
                          ? "همه خبرهای حساب‌تان را دیده‌اید."
                          : "خبرهای شارژ، پرداخت‌ها و ساختمان اینجا می‌آیند."}
                      </p>
                    </div>
                  )}
                  <ul className="divide-y divide-border/60 py-2">
                    {items?.map((notice) => (
                      <li
                        key={notice.id}
                        className={`group flex items-center gap-1 rounded-lg ${notice.read ? "" : "bg-primary/5"}`}
                      >
                        <Link
                          href={notice.href}
                          onClick={(event) => {
                            if (
                              event.metaKey ||
                              event.ctrlKey ||
                              event.shiftKey ||
                              event.altKey
                            )
                              return;
                            event.preventDefault();
                            if (notice.read) {
                              setOpen(false);
                              router.push(notice.href);
                            } else void read(notice.id, notice.href);
                          }}
                          aria-disabled={pending && !notice.read}
                          className="min-w-0 flex-1 rounded-lg px-3 py-3 text-right outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex items-start gap-2">
                            {!notice.read && (
                              <span
                                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                                aria-label="خوانده‌نشده"
                              />
                            )}
                            <p
                              className={`min-w-0 break-words text-[13px] leading-6 ${notice.read ? "font-medium" : "font-semibold"}`}
                            >
                              {notice.title}
                            </p>
                          </div>
                          <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
                            {notice.body}
                          </p>
                          <time
                            dateTime={notice.createdAt}
                            className="mt-2 block text-[10px] text-muted-foreground"
                          >
                            {dateFormat.format(new Date(notice.createdAt))}
                          </time>
                        </Link>
                        {!notice.read && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="me-1 text-primary"
                            disabled={pending}
                            onClick={() => void read(notice.id)}
                            aria-label={`خواندم: ${notice.title}`}
                            title="علامت‌گذاری به‌عنوان خوانده‌شده"
                          >
                            <Check aria-hidden="true" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </Tabs.Content>
              );
            })}
          </Tabs.Root>
          <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-border p-3">
            <Button
              variant="ghost"
              className="w-full min-w-0 px-2"
              disabled={!count || pending || !data}
              onClick={() => void read()}
            >
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCheck aria-hidden="true" />
              )}
              همه را خواندم
            </Button>
            <Button asChild variant="outline" className="w-full min-w-0 px-2">
              <Link
                href={`/${role}/notifications`}
                onClick={() => setOpen(false)}
              >
                مشاهده همه
                <ArrowLeft aria-hidden="true" />
              </Link>
            </Button>
          </footer>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

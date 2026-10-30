"use client";
import { CacheControls } from "@/components/cache-controls";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notifications/bell";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Building2,
  ChartLine,
  Settings,
  LayoutGrid,
  Receipt,
  Users,
  Wallet,
  CalendarDays,
  Menu,
  X,
  House,
  CircleCheck,
  Wrench,
  Undo2,
  MessageCircle,
  SlidersHorizontal,
  ChevronDown,
  Bell,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { CHAT_SEEN_EVENT, readChatSeen } from "@/lib/chat-seen";
import { cn } from "@/lib/utils";

const managerNav = [
  { href: "/manager", label: "نمای کلی", icon: LayoutGrid },
  { href: "/manager/units", label: "واحدها و ساکنان", icon: Building2 },
  { href: "/manager/periods", label: "شارژ و صورت‌حساب‌ها", icon: Receipt },
  { href: "/manager/expenses", label: "هزینه‌های ساختمان", icon: Wallet },
  { href: "/manager/bills", label: "قبوض و سررسیدها", icon: Receipt },
  { href: "/manager/notifications", label: "اعلان‌ها", icon: Bell },
  {
    href: "/manager/payments",
    label: "دریافت‌ها و پرداخت‌ها",
    icon: CircleCheck,
  },
  { href: "/manager/calendar", label: "تقویم ساختمان", icon: CalendarDays },
  { href: "/manager/maintenance", label: "تعمیرات و درخواست‌ها", icon: Wrench },
  { href: "/manager/chat", label: "گفتگوی ساختمان", icon: MessageCircle },
  { href: "/manager/reports", label: "گزارش‌های مالی", icon: ChartLine },
];
const settingsHref = "/manager/settings";
const settingsChildren = [
  { href: "/manager/account", label: "حساب کاربری من", icon: Users },
  {
    href: "/manager/history",
    label: "سابقه و بازیابی",
    icon: Undo2,
  },
  {
    href: "/manager/categories",
    label: "قواعد تقسیم هزینه",
    icon: SlidersHorizontal,
  },
  { href: "/manager/residents", label: "حساب‌ها و دسترسی‌ها", icon: Users },
];
const residentNav = [
  { href: "/resident", label: "خانه من", icon: House },
  { href: "/resident/invoices", label: "فیش‌های من", icon: Receipt },
  { href: "/resident/payments", label: "پرداخت شارژ", icon: Wallet },
  {
    href: "/resident/chat",
    label: "گفتگوی ساختمان",
    shortLabel: "گفتگو",
    icon: MessageCircle,
  },
  { href: "/resident/maintenance", label: "درخواست رسیدگی", icon: Wrench },
  { href: "/resident/account", label: "حساب کاربری من", icon: Users },
  { href: "/resident/notifications", label: "اعلان‌ها", icon: Bell },
];
export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Building2 size={25} strokeWidth={2.5} />
      </span>
      <div>
        <p className="text-[22px] font-extrabold tracking-tight">
          واحدبان<span className="text-primary">.</span>
        </p>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          زندگی مشترک، حساب‌وکتاب روشن
        </p>
      </div>
    </div>
  );
}
export function AppShell({
  role,
  title,
  userName = "",
  children,
}: {
  role: "manager" | "resident";
  title: string;
  userName?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const accountHref =
    role === "manager" ? "/manager/account" : "/resident/account";
  const [open, setOpen] = useState(false);
  const settingsOpen =
    path === settingsHref ||
    settingsChildren.some(
      (item) => path === item.href || path.startsWith(`${item.href}/`),
    );
  const [settingsExpanded, setSettingsExpanded] = useState(settingsOpen);
  const [trackedSettingsOpen, setTrackedSettingsOpen] = useState(settingsOpen);
  if (settingsOpen !== trackedSettingsOpen) {
    setTrackedSettingsOpen(settingsOpen);
    if (settingsOpen) setSettingsExpanded(true);
  }
  const [unreadChat, setUnreadChat] = useState(false);
  const onChat = path.endsWith("/chat");
  const showUnread = unreadChat && !onChat;

  useEffect(() => {
    let cancelled = false;

    async function checkUnread() {
      try {
        const response = await fetch("/api/chat/status", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const status = (await response.json()) as {
          buildingId?: string;
          latestId?: string | null;
          fromSelf?: boolean;
        };
        if (cancelled || !status.buildingId) return;
        const seen = readChatSeen(status.buildingId);
        setUnreadChat(
          Boolean(
            status.latestId && !status.fromSelf && status.latestId !== seen,
          ),
        );
      } catch {
        // The badge is optional; a failed poll should not interrupt the page.
      }
    }

    void checkUnread();
    const interval = window.setInterval(() => void checkUnread(), 8_000);
    window.addEventListener(CHAT_SEEN_EVENT, checkUnread);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener(CHAT_SEEN_EVENT, checkUnread);
    };
  }, [path]);
  const nav = role === "manager" ? managerNav : residentNav;
  const current =
    settingsChildren.find((item) => item.href === path) ??
    [
      ...nav,
      { href: settingsHref, label: "تنظیمات ساختمان", icon: Settings },
    ].find((item) => item.href === path) ??
    nav.find((item) => item.href !== "/manager" && path.startsWith(item.href));
  const links = (items: typeof nav) =>
    items.map((item) => {
      const active =
        item.href === path ||
        (item.href !== "/manager" &&
          item.href !== "/resident" &&
          path.startsWith(item.href));
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex min-h-10 items-center gap-3 rounded-lg px-3.5 text-[12px] transition-colors",
            active
              ? "bg-secondary font-semibold text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <item.icon size={20} strokeWidth={active ? 2.25 : 1.75} />
          <span>{item.label}</span>
          {item.href.endsWith("/chat") && showUnread ? (
            <span
              className="ms-auto size-2 rounded-full bg-destructive"
              aria-label="پیام خوانده‌نشده"
            />
          ) : (
            active && (
              <span className="ms-auto size-1.5 rounded-full bg-primary" />
            )
          )}
        </Link>
      );
    });
  const sidebar = (
    <div className="flex h-full flex-col px-5 py-6">
      <Link
        href={role === "manager" ? "/manager" : "/resident"}
        className="px-2"
      >
        <Brand />
      </Link>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-border p-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
          <Building2 size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{title}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {role === "manager" ? "پنل مدیریت ساختمان" : "پنل ساکن ساختمان"}
          </p>
        </div>
      </div>
      <p className="mb-3 mt-7 px-3 text-[10px] font-medium text-muted-foreground">
        {role === "manager" ? "مدیریت روزمره" : "دسترسی‌های شما"}
      </p>
      <nav aria-label="منوی اصلی" className="space-y-1">
        {links(nav)}
      </nav>
      {role === "manager" && (
        <>
          <div className="mx-3 mb-4 mt-5 border-t border-border" />
          <nav aria-label="تنظیمات ساختمان" className="space-y-1">
            <div
              className={cn(
                "flex min-h-10 items-center rounded-lg pe-1 transition-colors",
                path === settingsHref
                  ? "bg-secondary text-primary"
                  : settingsOpen
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
            >
              <Link
                href={settingsHref}
                onClick={() => {
                  setOpen(false);
                  setSettingsExpanded(true);
                }}
                aria-current={path === settingsHref ? "page" : undefined}
                className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-lg px-3.5 text-[12px] hover:text-foreground"
              >
                <Settings size={20} strokeWidth={settingsOpen ? 2.25 : 1.75} />
                <span className={settingsOpen ? "font-semibold" : undefined}>
                  تنظیمات ساختمان
                </span>
              </Link>
              <button
                type="button"
                aria-expanded={settingsExpanded}
                aria-label={
                  settingsExpanded
                    ? "بستن زیرمنوی تنظیمات"
                    : "باز کردن زیرمنوی تنظیمات"
                }
                onClick={() => setSettingsExpanded((value) => !value)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground"
              >
                <ChevronDown
                  size={16}
                  className={cn(
                    "transition-transform duration-200",
                    settingsExpanded && "rotate-180",
                  )}
                />
              </button>
            </div>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200",
                settingsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="ms-5 space-y-0.5 border-s border-border ps-2">
                  {settingsChildren.map((item) => {
                    const active =
                      path === item.href || path.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-8 items-center gap-2 rounded-lg px-2.5 text-[11px] transition-colors",
                          active
                            ? "bg-secondary font-semibold text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <item.icon
                          size={15}
                          strokeWidth={active ? 2.25 : 1.75}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>
        </>
      )}
      <div className="mt-auto pt-6">
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
            {userName?.slice(0, 1) || "م"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">
              {userName || "حساب کاربری"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {role === "manager" ? "مدیر ساختمان" : "ساکن"}
            </p>
          </div>
          <Link
            href={accountHref}
            aria-label="تنظیمات حساب کاربری"
            title="تنظیمات حساب کاربری"
            aria-current={path === accountHref ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
              path === accountHref
                ? "bg-secondary text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
  return (
    <div className="min-h-[100dvh]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:z-50 focus:bg-card focus:p-4"
      >
        رفتن به محتوای اصلی
      </a>
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-[240px] overflow-y-auto border-l border-border bg-card lg:block">
        {sidebar}
      </aside>
      <div
        className={cn(
          "lg:mr-[240px]",
          !onChat && "max-lg:pt-[calc(4rem+env(safe-area-inset-top))]",
        )}
      >
        <header
          className={cn(
            "flex h-16 items-center justify-between border-b border-border bg-card px-5 lg:px-9",
            "max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-30 max-lg:h-[calc(4rem+env(safe-area-inset-top))] max-lg:pt-[env(safe-area-inset-top)]",
            onChat && "max-lg:hidden",
          )}
        >
          <div className="flex items-center gap-2.5 text-xs">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button
                  className="relative inline-flex size-9 items-center justify-center rounded-lg lg:hidden"
                  aria-label={
                    showUnread
                      ? "باز کردن منو، پیام جدید دارید"
                      : "باز کردن منو"
                  }
                >
                  <Menu size={18} />
                  {showUnread && (
                    <span className="absolute top-1.5 start-1.5 size-2 rounded-full bg-destructive" />
                  )}
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="motion-overlay fixed inset-0 z-40 bg-black/35" />
                <Dialog.Content className="motion-drawer fixed inset-y-0 right-0 z-50 w-[280px] overflow-y-auto bg-card">
                  <Dialog.Title className="sr-only">منوی ساختمان</Dialog.Title>
                  <Dialog.Description className="sr-only">
                    دسترسی به بخش‌های مدیریت ساختمان
                  </Dialog.Description>
                  <Dialog.Close
                    className="absolute left-3 top-3 p-2"
                    aria-label="بستن منو"
                  >
                    <X size={19} />
                  </Dialog.Close>
                  {sidebar}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <span className="text-sm font-semibold">
              {current?.label || "جزئیات دوره"}
            </span>
          </div>
          <div className="flex items-center">
            <NotificationBell role={role} />
            {role === "manager" && <CacheControls />}
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main-content"
          className={cn(
            "mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-9 lg:py-8",
            !onChat && "max-lg:scroll-mt-[calc(4rem+env(safe-area-inset-top))]",
            role === "resident" && !onChat && "pb-24 lg:pb-8",
            onChat && "max-lg:max-w-none max-lg:p-0",
          )}
        >
          {children}
        </main>
        {role === "resident" && !onChat && (
          <nav
            aria-label="دسترسی سریع ساکن"
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          >
            {residentNav
              .filter(
                (item) =>
                  item.href !== "/resident/account" &&
                  item.href !== "/resident/notifications",
              )
              .map((item) => {
                const active =
                  item.href === path ||
                  (item.href !== "/resident" && path.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[9px] transition-colors",
                      active
                        ? "font-semibold text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    <span className="relative">
                      <item.icon size={20} strokeWidth={active ? 2.4 : 1.75} />
                      {item.href.endsWith("/chat") && showUnread && (
                        <span className="absolute -top-0.5 -start-1 size-2 rounded-full bg-destructive" />
                      )}
                    </span>
                    <span className="max-w-full truncate">
                      {"shortLabel" in item ? item.shortLabel : item.label}
                    </span>
                  </Link>
                );
              })}
          </nav>
        )}
      </div>
    </div>
  );
}

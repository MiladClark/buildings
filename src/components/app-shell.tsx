"use client";
import { ThemeToggle } from "@/components/theme-toggle";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Buildings,
  ChartLineUp,
  GearSix,
  SquaresFour,
  Receipt,
  Users,
  Wallet,
  CalendarDots,
  List,
  X,
  House,
  CheckCircle,
  Wrench,
  ArrowCounterClockwise,
  ChatCircleDots,
} from "@phosphor-icons/react";
import { SignOutButton } from "@/components/sign-out-button";
import { CHAT_SEEN_EVENT, readChatSeen } from "@/lib/chat-seen";
import { cn } from "@/lib/utils";

const managerNav = [
  { href: "/manager", label: "نمای کلی", icon: SquaresFour },
  { href: "/manager/units", label: "واحدها و ساکنان", icon: Buildings },
  { href: "/manager/periods", label: "شارژ و صورت‌حساب‌ها", icon: Receipt },
  { href: "/manager/expenses", label: "هزینه‌های ساختمان", icon: Wallet },
  {
    href: "/manager/payments",
    label: "دریافت‌ها و پرداخت‌ها",
    icon: CheckCircle,
  },
  { href: "/manager/calendar", label: "تقویم ساختمان", icon: CalendarDots },
  { href: "/manager/maintenance", label: "تعمیرات و درخواست‌ها", icon: Wrench },
  { href: "/manager/chat", label: "گفتگوی ساختمان", icon: ChatCircleDots },
  { href: "/manager/reports", label: "گزارش‌های مالی", icon: ChartLineUp },
];
const secondaryNav = [
  {
    href: "/manager/history",
    label: "سابقه و بازیابی",
    icon: ArrowCounterClockwise,
  },
  { href: "/manager/categories", label: "قواعد تقسیم هزینه", icon: GearSix },
  { href: "/manager/residents", label: "حساب ساکنان", icon: Users },
  { href: "/manager/settings", label: "تنظیمات ساختمان", icon: GearSix },
];
const residentNav = [
  { href: "/resident", label: "خانه من", icon: House },
  { href: "/resident/invoices", label: "فیش‌های من", icon: Receipt },
  { href: "/resident/payments", label: "پرداخت شارژ", icon: Wallet },
  {
    href: "/resident/chat",
    label: "گفتگوی ساختمان",
    shortLabel: "گفتگو",
    icon: ChatCircleDots,
  },
  { href: "/resident/maintenance", label: "درخواست رسیدگی", icon: Wrench },
];
export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Buildings size={25} weight="bold" />
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
  const [open, setOpen] = useState(false);
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
    [...nav, ...secondaryNav].find((n) => n.href === path) ??
    nav.find((n) => n.href !== "/manager" && path.startsWith(n.href));
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
          <item.icon size={20} weight={active ? "duotone" : "regular"} />
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
          <Buildings size={20} />
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
          <p className="mb-3 px-3 text-[10px] font-medium text-muted-foreground">
            تنظیمات و سابقه
          </p>
          <nav aria-label="تنظیمات و دسترسی‌ها" className="space-y-1">
            {links(secondaryNav)}
          </nav>
        </>
      )}
      <div className="mt-auto pt-6">
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-bold">
            {userName?.slice(0, 1) || "م"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">
              {userName || "حساب کاربری"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {role === "manager" ? "مدیر ساختمان" : "ساکن"}
            </p>
          </div>
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
      <div className="lg:mr-[240px]">
        <header
          className={cn(
            "flex h-16 items-center justify-between border-b border-border bg-card px-5 lg:px-9",
            onChat && "max-lg:hidden",
          )}
        >
          <div className="flex items-center gap-2.5 text-xs">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button
                  className="relative p-2 lg:hidden"
                  aria-label={
                    showUnread
                      ? "باز کردن منو، پیام جدید دارید"
                      : "باز کردن منو"
                  }
                >
                  <List size={23} />
                  {showUnread && (
                    <span className="absolute top-1.5 start-1.5 size-2 rounded-full bg-destructive" />
                  )}
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35" />
                <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[280px] overflow-y-auto bg-card">
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
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main-content"
          className={cn(
            "mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-9 lg:py-8",
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
            {residentNav.map((item) => {
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
                    <item.icon size={20} weight={active ? "fill" : "regular"} />
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

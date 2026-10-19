"use client";
import { ThemeToggle } from "@/components/theme-toggle";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  CaretLeft,
  List,
  X,
  House,
  ArrowUpLeft,
  Bell,
  CheckCircle,
  Wrench,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { SignOutButton } from "@/components/sign-out-button";
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
          هم‌خانه<span className="text-primary">.</span>
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
          {active && (
            <span className="ms-auto size-1.5 rounded-full bg-primary" />
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
      <p className="mb-3 mt-7 px-3 text-[10px] text-muted-foreground">
        مدیریت ساختمان
      </p>
      <nav aria-label="منوی اصلی" className="space-y-1">
        {links(nav)}
      </nav>
      {role === "manager" && (
        <>
          <div className="mx-3 my-5 border-t border-border" />
          <nav aria-label="تنظیمات و دسترسی‌ها" className="space-y-1">
            {links(secondaryNav)}
          </nav>
        </>
      )}
      <div className="mt-auto pt-8">
        <div className="sidebar-note mb-5 rounded-xl bg-secondary/60 p-4">
          <House size={22} className="mb-2 text-primary" />
          <p className="text-xs font-medium">همسایگی، کمی آسوده‌تر</p>
          <p className="mt-2 text-[10px] leading-6 text-muted-foreground">
            حساب‌های شفاف برای ساختمان شما و خیال راحت همسایه‌ها.
          </p>
        </div>
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
        <header className="flex h-[76px] items-center justify-between border-b border-border bg-card px-5 lg:px-9">
          <div className="flex items-center gap-2.5 text-xs">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button className="p-2 lg:hidden" aria-label="باز کردن منو">
                  <List size={23} />
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
            <span className="hidden text-muted-foreground sm:inline">
              {title}
            </span>
            <CaretLeft
              size={12}
              className="hidden text-muted-foreground sm:block"
            />
            <span className="font-medium">
              {current?.label || "جزئیات دوره"}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <span className="hidden items-center gap-2 text-[11px] text-muted-foreground md:flex">
              <CalendarDots size={17} />
              {new Intl.DateTimeFormat("fa-IR", {
                timeZone: "Asia/Tehran",
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date())}
            </span>
            <span className="hidden h-5 border-l border-border md:block" />
            <Link
              href={role === "manager" ? "/manager/payments" : "/resident"}
              aria-label="اعلان‌ها و درخواست‌ها"
              className="p-2 text-muted-foreground hover:text-primary"
            >
              <Bell size={20} />
            </Link>
            <span className="rounded-lg bg-secondary px-2.5 py-1.5 text-[10px] font-medium text-primary">
              {role === "manager" ? "مدیر ساختمان" : "ساکن"}
            </span>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-9 lg:py-8"
        >
          {children}
        </main>
        <footer className="mx-5 mt-8 flex flex-wrap justify-between gap-2 border-t border-border py-5 text-[10px] text-muted-foreground lg:mx-9">
          <span>هم‌خانه، همراه مدیریت ساختمان شما</span>
          <span className="flex items-center gap-1">
            تمام مبالغ به تومان <ArrowUpLeft size={12} />
          </span>
        </footer>
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResidentNotificationMenu } from "./resident-menu";
export function NotificationBell({ role }: { role: "manager" | "resident" }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const r = await fetch("/api/notifications/status", {
          cache: "no-store",
        });
        if (r.ok) {
          const data = await r.json();
          if (!cancelled) setCount(Number(data.unread) || 0);
        }
      } catch {}
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("notifications-updated", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("notifications-updated", refresh);
    };
  }, []);
  const label = count
    ? `اعلان‌ها؛ ${count.toLocaleString("fa-IR")} خوانده‌نشده`
    : "اعلان‌ها";
  const icon = (
    <>
      <Bell size={19} aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 end-0.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground"
        >
          {count > 99 ? "۹۹+" : count.toLocaleString("fa-IR")}
        </span>
      )}
    </>
  );
  if (role === "resident")
    return (
      <ResidentNotificationMenu count={count} onCountChange={setCount}>
        <Button
          size="icon"
          variant="ghost"
          className="relative text-muted-foreground"
          aria-label={label}
          title="اعلان‌ها"
        >
          {icon}
        </Button>
      </ResidentNotificationMenu>
    );
  return (
    <Button
      asChild
      size="icon"
      variant="ghost"
      className="relative text-muted-foreground"
    >
      <Link href={`/${role}/notifications`} aria-label={label}>
        {icon}
      </Link>
    </Button>
  );
}

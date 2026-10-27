"use client";
import { useEffect, useSyncExternalStore } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Moon, Sun, Monitor, Check } from "lucide-react";
const key = "hamkhane-theme";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(key, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(key, callback);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(key) || "system";
  } catch {
    return "system";
  }
}
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, snapshot, () => "system");
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);
  const set = (theme: string) => {
    try {
      localStorage.setItem(key, theme);
    } catch {}
    window.dispatchEvent(new Event(key));
  };
  return (
    <DropdownMenu.Root dir="rtl">
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="انتخاب پوسته نمایش"
          title="پوسته نمایش"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"
        >
          {mode === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="motion-pop z-50 min-w-40 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          {[
            { value: "light", label: "روشن", icon: Sun },
            { value: "dark", label: "تیره", icon: Moon },
            { value: "system", label: "مطابق سیستم", icon: Monitor },
          ].map((t) => (
            <DropdownMenu.Item
              key={t.value}
              onSelect={() => set(t.value)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-xs outline-none data-[highlighted]:bg-muted"
            >
              <t.icon size={16} />
              {t.label}
              {mode === t.value && (
                <Check className="ms-auto text-primary" size={14} />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

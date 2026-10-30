"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { themeStorageKey as key, type Theme } from "@/lib/theme";
function subscribe(callback: () => void) {
  const update = () => {
    document.documentElement.dataset.theme = snapshot();
    callback();
  };
  window.addEventListener("storage", update);
  window.addEventListener(key, update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener(key, update);
  };
}
function snapshot(): Theme {
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(key, theme);
  } catch {}
  window.dispatchEvent(new Event(key));
}
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, snapshot, () => "light");
  const label =
    mode === "dark" ? "فعال کردن پوسته روشن" : "فعال کردن پوسته تیره";
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-primary"
      onClick={() => setTheme(snapshot() === "dark" ? "light" : "dark")}
    >
      {mode === "dark" ? (
        <Sun size={19} aria-hidden="true" />
      ) : (
        <Moon size={19} aria-hidden="true" />
      )}
    </Button>
  );
}

"use client";

import { useSyncExternalStore } from "react";

export const rowLimitOptions = [5, 10, 20, 50, 100, "all"] as const;
export type RowLimit = (typeof rowLimitOptions)[number];

const prefix = "hamkhane:table-row-limit:";
const changeEvent = "hamkhane:table-row-limit-changed";
// Keep the control usable when the browser blocks persistent storage.
const fallback = new Map<string, string>();

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.startsWith(prefix)) return;
    if (event.key === null) fallback.clear();
    else fallback.delete(event.key);
    callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, callback);
  };
}

function read(key: string) {
  if (fallback.has(key)) return fallback.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useTablePageSize(tableKey: string, defaultSize: number) {
  const key = prefix + tableKey;
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const selected =
    rowLimitOptions.find((option) => String(option) === stored) ??
    rowLimitOptions.find((option) => option === defaultSize) ??
    10;

  function setSelected(value: RowLimit) {
    try {
      localStorage.setItem(key, String(value));
      fallback.delete(key);
    } catch {
      fallback.set(key, String(value));
    }
    window.dispatchEvent(new Event(changeEvent));
  }
  return [selected, setSelected] as const;
}

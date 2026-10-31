"use client";

import { useEffect, useRef, useState, isValidElement } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { Check, CircleAlert, Info, LoaderCircle, X } from "lucide-react";
import { toast, useSonner, type ToastT } from "sonner";

// Adapted for the app's RTL design and existing toast API from React Bits SwipeToast:
// https://reactbits.dev/micro/swipe-toast (discovered through the @react-bits MCP registry).
function SwipeToast({ record }: { record: ToastT }) {
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const progress = useMotionValue(1);
  const duration = record.duration ?? (record.type === "error" ? 8000 : 4500);
  const remaining = useRef(duration);
  const loading = record.type === "loading";
  const dismiss = () => {
    toast.dismiss(record.id);
    record.onDismiss?.(record);
  };
  useEffect(() => {
    if (paused || loading || !Number.isFinite(duration) || duration <= 0)
      return;
    const started = performance.now();
    const control = animate(progress, 0, {
      duration: remaining.current / 1000,
      ease: "linear",
      onComplete: () => {
        toast.dismiss(record.id);
        record.onAutoClose?.(record);
      },
    });
    return () => {
      remaining.current = Math.max(
        0,
        remaining.current - (performance.now() - started),
      );
      control.stop();
    };
  }, [paused, loading, duration, progress, record]);
  useEffect(() => {
    const changed = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  const Icon = loading
    ? LoaderCircle
    : record.type === "error" || record.type === "warning"
      ? CircleAlert
      : record.type === "success"
        ? Check
        : Info;
  const title =
    typeof record.title === "function" ? record.title() : record.title;
  const description =
    typeof record.description === "function"
      ? record.description()
      : record.description;
  const action = record.action;
  return (
    <motion.div
      layout={!reduce}
      initial={{ opacity: 0, y: reduce ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : 20 }}
      drag={record.dismissible === false ? false : "y"}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.3}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.y) > 45) dismiss();
      }}
      className="app-toast"
      data-tone={record.type}
      dir="rtl"
      role={record.type === "error" ? "alert" : "status"}
      aria-atomic="true"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && record.dismissible !== false) {
          event.stopPropagation();
          dismiss();
        }
      }}
    >
      <span className="app-toast-icon">
        <Icon
          size={19}
          aria-hidden="true"
          className={loading ? "animate-spin" : undefined}
        />
      </span>
      <div className="min-w-0 flex-1">
        {record.jsx ?? (
          <>
            <p className="font-medium leading-7">{title}</p>
            {description && (
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {description}
              </p>
            )}
          </>
        )}
        {action &&
          (isValidElement(action) ? (
            action
          ) : typeof action === "object" && "label" in action ? (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-primary"
              onClick={(event) => {
                action.onClick(event);
                dismiss();
              }}
            >
              {action.label}
            </button>
          ) : null)}
        {record.type === "error" &&
          typeof title === "string" &&
          /صفحه را تازه/.test(title) && (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-primary"
              onClick={() => window.location.reload()}
            >
              تازه‌کردن صفحه
            </button>
          )}
      </div>
      {record.dismissible !== false && (
        <button
          type="button"
          aria-label="بستن پیام"
          onClick={dismiss}
          className="app-toast-close"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
      {!loading && duration > 0 && Number.isFinite(duration) && (
        <motion.i
          aria-hidden="true"
          className="app-toast-fuse"
          style={{ scaleX: progress }}
        />
      )}
    </motion.div>
  );
}

export function AppNotifications() {
  const { toasts } = useSonner();
  if (!toasts.length) return null;
  return createPortal(
    <section className="app-toast-stack" aria-label="پیام‌های برنامه">
      <AnimatePresence initial={false}>
        {toasts.slice(0, 3).map((record) => (
          <SwipeToast key={record.id} record={record} />
        ))}
      </AnimatePresence>
    </section>,
    document.body,
  );
}

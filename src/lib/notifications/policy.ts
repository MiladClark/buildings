import { z } from "zod";
import { isoDate } from "@/lib/format/jalali";
import {
  defaultPolicy,
  defaultPreferences,
  type NotificationPolicy,
  type NotificationPreferences,
} from "./types";

const flags = {
  invoice: z.boolean(),
  charge_due: z.boolean(),
  bill_due: z.boolean(),
  payment: z.boolean(),
  announcement: z.boolean(),
  system: z.boolean(),
};
const lead = z
  .array(z.number().int().min(0).max(30))
  .max(10)
  .transform((a) => [...new Set(a)].sort((a, b) => b - a));
export const policySchema = z.object({
  ...flags,
  enabled: z.boolean(),
  pushEnabled: z.boolean(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  chargeLeadDays: lead,
  billLeadDays: lead,
  overdueEveryDays: z.number().int().min(1).max(30),
  maxOverdue: z.number().int().min(0).max(12),
});
export const preferenceSchema = z.object({
  ...flags,
  pushEnabled: z.boolean(),
  quietStart: z.number().int().min(0).max(23),
  quietEnd: z.number().int().min(0).max(23),
  showDetails: z.boolean(),
});
export function readPolicy(
  value?: Partial<NotificationPolicy> | null,
): NotificationPolicy {
  return { ...defaultPolicy, ...value };
}
export function readPreferences(
  value?: Partial<NotificationPreferences> | null,
): NotificationPreferences {
  return { ...defaultPreferences, ...value };
}
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tehran",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function tehranClock(now: Date) {
  const p = clock.formatToParts(now);
  return {
    hour: Number(p.find((v) => v.type === "hour")!.value),
    minute: Number(p.find((v) => v.type === "minute")!.value),
  };
}
export function tehranTime(day: string, hour: number, minute = 0) {
  return new Date(
    `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+03:30`,
  );
}
export function dayDifference(a: string, b: string) {
  return Math.round(
    (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000,
  );
}
export function reminderSlot(
  due: string,
  today: string,
  leadDays: number[],
  repeat: number,
  limit: number,
) {
  const delta = dayDifference(due, today);
  if (leadDays.includes(delta)) return `before:${delta}`;
  if (delta < 0 && -delta % repeat === 0 && -delta / repeat <= limit)
    return `overdue:${-delta / repeat}`;
  return null;
}
export function afterQuietHours(now: Date, pref: NotificationPreferences) {
  const { hour } = tehranClock(now);
  const { quietStart: start, quietEnd: end } = pref;
  if (
    start === end ||
    !(start < end ? hour >= start && hour < end : hour >= start || hour < end)
  )
    return now;
  const next = tehranTime(isoDate(now), end);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
export function safeNotificationHref(href: string) {
  return /^\/(manager|resident)(\/|\?|$)/.test(href) && !/[\\\r\n]/.test(href)
    ? href
    : "/";
}

"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  appNotification,
  expenseLine,
  billingPeriod,
  notificationPreference,
  notificationRule,
  pushSubscription,
  scheduledAnnouncement,
  standaloneExpense,
  unit,
} from "@/lib/db/schema";
import {
  requireManager,
  requireSession,
  getMembershipForUser,
} from "@/lib/session";
import { latinDigits } from "@/lib/auth/phone";
import { enqueueNotice } from "@/lib/notifications/store";
import {
  defaultPolicy,
  defaultPreferences,
  notificationKinds,
} from "@/lib/notifications/types";
import {
  policySchema,
  preferenceSchema,
  tehranTime,
} from "@/lib/notifications/policy";
import { getPushIdentity, validPushEndpoint } from "@/lib/notifications/push";
import { runNotificationCycle } from "@/lib/notifications/worker";
import { logManagementEvent } from "@/lib/billing/corrections";
import { utilityBillFromForm } from "@/lib/billing/utility-bill";
import { invalidateBuildingCache } from "@/lib/cache/building";

async function context() {
  const session = await requireSession(),
    member = await getMembershipForUser(session.user.id);
  if (!member) throw new Error("حساب به ساختمانی متصل نیست.");
  return { session, member };
}
function refresh() {
  revalidatePath("/manager/notifications");
  revalidatePath("/resident/notifications");
  revalidatePath("/resident");
}
export async function saveNotificationRules(form: FormData) {
  const { session, member } = await requireManager();
  const days = (name: string) =>
    latinDigits(String(form.get(name) ?? ""))
      .split(/[,،\s]+/)
      .filter(Boolean)
      .map(Number);
  const parsed = policySchema.safeParse({
    ...defaultPolicy,
    ...Object.fromEntries(
      ["enabled", "pushEnabled", ...notificationKinds].map((k) => [
        k,
        form.get(k) === "on",
      ]),
    ),
    hour: Number(form.get("hour")),
    minute: Number(form.get("minute")),
    chargeLeadDays: days("chargeLeadDays"),
    billLeadDays: days("billLeadDays"),
    overdueEveryDays: Number(form.get("overdueEveryDays")),
    maxOverdue: Number(form.get("maxOverdue")),
  });
  if (!parsed.success)
    throw new Error(
      "ساعت، روزهای یادآوری (صفر تا ۳۰) و تعداد تکرار (صفر تا ۱۲) را بررسی کنید.",
    );
  const settings = parsed.data;
  await db.transaction(async (tx) => {
    const before = await tx.query.notificationRule.findFirst({
      where: eq(notificationRule.buildingId, member.buildingId),
    });
    await tx
      .insert(notificationRule)
      .values({ buildingId: member.buildingId, settings })
      .onConflictDoUpdate({
        target: notificationRule.buildingId,
        set: { settings, updatedAt: new Date() },
      });
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "notification",
      member.buildingId,
      "edit",
      "تنظیمات اعلان ساختمان",
      before?.settings,
      settings,
    );
  });
  refresh();
}
export async function saveNotificationPreferences(form: FormData) {
  const { session } = await context();
  const parsed = preferenceSchema.safeParse({
    ...defaultPreferences,
    ...Object.fromEntries(
      ["pushEnabled", "showDetails", ...notificationKinds].map((k) => [
        k,
        form.get(k) === "on",
      ]),
    ),
    quietStart: Number(form.get("quietStart")),
    quietEnd: Number(form.get("quietEnd")),
  });
  if (!parsed.success)
    throw new Error("ساعت سکوت و تنظیمات دریافت را درست وارد کنید.");
  const settings = parsed.data;
  await db
    .insert(notificationPreference)
    .values({ userId: session.user.id, settings })
    .onConflictDoUpdate({
      target: notificationPreference.userId,
      set: { settings },
    });
  refresh();
}
export async function subscribePush(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceName: string;
}) {
  const { session, member } = await context();
  if (
    !validPushEndpoint(input?.endpoint) ||
    !/^[\w-]{80,100}$/.test(input?.keys?.p256dh ?? "") ||
    !/^[\w-]{20,30}$/.test(input?.keys?.auth ?? "") ||
    Buffer.from(input.keys.p256dh, "base64url").length !== 65 ||
    Buffer.from(input.keys.auth, "base64url").length !== 16
  )
    throw new Error("اشتراک اعلان دستگاه معتبر نیست.");
  await getPushIdentity();
  const value = {
    userId: session.user.id,
    buildingId: member.buildingId,
    keys: input.keys,
    deviceName: String(input.deviceName || "مرورگر").slice(0, 100),
    lastSeenAt: new Date(),
  };
  await db
    .insert(pushSubscription)
    .values({ id: crypto.randomUUID(), endpoint: input.endpoint, ...value })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: value });
  refresh();
}
export async function unsubscribePush(endpoint: string) {
  const { session } = await context();
  await db
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, session.user.id),
        eq(pushSubscription.endpoint, endpoint),
      ),
    );
  refresh();
}
export async function removePushDevice(id: string) {
  const { session } = await context();
  await db
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.id, id),
        eq(pushSubscription.userId, session.user.id),
      ),
    );
  refresh();
}
export async function markNotificationRead(id?: string) {
  const { session } = await context();
  await db
    .update(appNotification)
    .set({ read: true })
    .where(
      and(
        eq(appNotification.userId, session.user.id),
        id ? eq(appNotification.id, id) : undefined,
      ),
    );
  refresh();
}
export async function testOwnPush() {
  const { session, member } = await context();
  const id = await db.transaction((tx) =>
    enqueueNotice(tx, {
      buildingId: member.buildingId,
      userId: session.user.id,
      kind: "system",
      title: "اعلان آزمایشی واحدبان",
      body: "دریافت اعلان این دستگاه فعال است.",
      href: `/${member.role === "manager" ? "manager" : "resident"}/notifications`,
    }),
  );
  if (!id) throw new Error("ابتدا اعلان‌های حساب و ساختمان را فعال کنید.");
  refresh();
}
export async function createAnnouncement(form: FormData) {
  const { session, member } = await requireManager();
  const title = String(form.get("title") ?? "").trim(),
    body = String(form.get("body") ?? "").trim(),
    audience = String(form.get("audience") ?? "all"),
    unitId = String(form.get("unitId") ?? "") || null;
  if (
    !title ||
    title.length > 150 ||
    !body ||
    body.length > 2000 ||
    !["all", "managers", "residents", "unit"].includes(audience)
  )
    throw new Error("عنوان، متن و مخاطبان را درست وارد کنید.");
  const day = String(form.get("sendDate") ?? ""),
    hour = Number(form.get("sendHour") ?? 9),
    minute = Number(form.get("sendMinute") ?? 0);
  const sendAt =
    form.get("timing") === "scheduled"
      ? tehranTime(day, hour, minute)
      : new Date();
  if (
    !Number.isFinite(sendAt.getTime()) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  )
    throw new Error("زمان ارسال معتبر نیست.");
  if (
    form.get("timing") === "scheduled" &&
    sendAt.getTime() < Date.now() - 60000
  )
    throw new Error("زمان ارسال نباید در گذشته باشد.");
  await db.transaction(async (tx) => {
    if (
      audience === "unit" &&
      (!unitId ||
        !(await tx.query.unit.findFirst({
          where: and(
            eq(unit.id, unitId),
            eq(unit.buildingId, member.buildingId),
            isNull(unit.deletedAt),
          ),
        })))
    )
      throw new Error("واحد معتبر انتخاب کنید.");
    const id = crypto.randomUUID();
    await tx.insert(scheduledAnnouncement).values({
      id,
      buildingId: member.buildingId,
      createdBy: session.user.id,
      title,
      body,
      audience: audience as "all" | "managers" | "residents" | "unit",
      unitId: audience === "unit" ? unitId : null,
      sendAt,
    });
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "notification",
      id,
      "create",
      "اطلاعیه ساختمان",
      undefined,
      { title, audience, sendAt },
    );
  });
  refresh();
}
export async function cancelAnnouncement(id: string) {
  const { member, session } = await requireManager();
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(scheduledAnnouncement)
      .set({ cancelledAt: new Date() })
      .where(
        and(
          eq(scheduledAnnouncement.id, id),
          eq(scheduledAnnouncement.buildingId, member.buildingId),
          isNull(scheduledAnnouncement.processedAt),
          isNull(scheduledAnnouncement.cancelledAt),
        ),
      )
      .returning();
    if (!row) throw new Error("این پیام ارسال یا قبلاً لغو شده است.");
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "notification",
      id,
      "cancel",
      row.title,
    );
  });
  refresh();
}
export async function processBuildingNotifications() {
  const { member } = await requireManager();
  await runNotificationCycle(new Date(), undefined, member.buildingId);
  refresh();
}
export async function saveUtilityBillDetails(
  target: { expenseId?: string; standaloneExpenseId?: string },
  form: FormData,
) {
  const { member, session } = await requireManager(),
    bill = utilityBillFromForm(form);
  if (!!target.expenseId === !!target.standaloneExpenseId)
    throw new Error("یک هزینه انتخاب کنید.");
  await db.transaction(async (tx) => {
    if (target.standaloneExpenseId) {
      const cost = await tx.query.standaloneExpense.findFirst({
        where: and(
          eq(standaloneExpense.id, target.standaloneExpenseId),
          eq(standaloneExpense.buildingId, member.buildingId),
          isNull(standaloneExpense.deletedAt),
        ),
      });
      if (!cost) throw new Error("هزینه پیدا نشد.");
      await tx
        .update(standaloneExpense)
        .set({ utilityBill: bill })
        .where(eq(standaloneExpense.id, cost.id));
      if (cost.linkedExpenseId)
        await tx
          .update(expenseLine)
          .set({ utilityBill: bill })
          .where(eq(expenseLine.id, cost.linkedExpenseId));
      await logManagementEvent(
        tx,
        member.buildingId,
        session.user.id,
        "standalone_expense",
        cost.id,
        "edit",
        "مشخصات قبض",
        cost.utilityBill,
        bill,
      );
    } else {
      const cost = await tx.query.expenseLine.findFirst({
        where: and(
          eq(expenseLine.id, target.expenseId!),
          isNull(expenseLine.deletedAt),
        ),
      });
      const period =
        cost &&
        (await tx.query.billingPeriod.findFirst({
          where: and(
            eq(billingPeriod.id, cost.periodId),
            eq(billingPeriod.buildingId, member.buildingId),
            isNull(billingPeriod.deletedAt),
          ),
        }));
      if (!cost || !period || cost.sourceStandaloneId)
        throw new Error("هزینه معتبر همین ساختمان انتخاب کنید.");
      await tx
        .update(expenseLine)
        .set({ utilityBill: bill })
        .where(eq(expenseLine.id, cost.id));
      await logManagementEvent(
        tx,
        member.buildingId,
        session.user.id,
        "expense",
        cost.id,
        "edit",
        "مشخصات قبض",
        cost.utilityBill,
        bill,
      );
    }
  });
  await invalidateBuildingCache(member.buildingId);
  revalidatePath("/manager/bills");
}

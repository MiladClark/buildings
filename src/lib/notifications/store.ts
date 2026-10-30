import { and, eq, inArray } from "drizzle-orm";
import {
  appNotification,
  membership,
  notificationDelivery,
  notificationPreference,
  notificationRule,
  pushSubscription,
} from "@/lib/db/schema";
import type { LedgerTransaction } from "@/lib/billing/settlement-store";
import {
  readPolicy,
  readPreferences,
  afterQuietHours,
  safeNotificationHref,
} from "./policy";
import type { NotificationKind } from "./types";

export type NoticeInput = {
  buildingId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  dedupeKey?: string;
  now?: Date;
  context?: typeof appNotification.$inferSelect.context;
};
export async function enqueueNotice(tx: LedgerTransaction, input: NoticeInput) {
  const now = input.now ?? new Date();
  const member = await tx.query.membership.findFirst({
    where: and(
      eq(membership.userId, input.userId),
      eq(membership.buildingId, input.buildingId),
    ),
  });
  if (!member) return null;
  const rule = await tx.query.notificationRule.findFirst({
    where: eq(notificationRule.buildingId, input.buildingId),
  });
  const prefRow = await tx.query.notificationPreference.findFirst({
    where: eq(notificationPreference.userId, input.userId),
  });
  const policy = readPolicy(rule?.settings),
    pref = readPreferences(prefRow?.settings);
  if (!policy.enabled || !policy[input.kind] || !pref[input.kind]) return null;
  const id = crypto.randomUUID();
  const [created] = await tx
    .insert(appNotification)
    .values({
      id,
      userId: input.userId,
      buildingId: input.buildingId,
      kind: input.kind,
      title: input.title.slice(0, 150),
      body: input.body.slice(0, 2000),
      href: safeNotificationHref(input.href),
      context: input.context,
      dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${input.userId}` : null,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: appNotification.id });
  if (!created) return null;
  if (policy.pushEnabled && pref.pushEnabled) {
    const subscriptions = await tx
      .select()
      .from(pushSubscription)
      .where(
        and(
          eq(pushSubscription.userId, input.userId),
          eq(pushSubscription.buildingId, input.buildingId),
        ),
      );
    if (subscriptions.length)
      await tx.insert(notificationDelivery).values(
        subscriptions.map((s) => ({
          id: crypto.randomUUID(),
          notificationId: id,
          subscriptionId: s.id,
          nextAttemptAt: afterQuietHours(now, pref),
          expiresAt: new Date(now.getTime() + 48 * 3600000),
        })),
      );
  }
  return id;
}
export async function notifyUnits(
  tx: LedgerTransaction,
  buildingId: string,
  unitIds: string[],
  title: string,
  body: string,
  kind: NotificationKind = "system",
  href = "/resident/invoices",
  dedupeKey?: string,
) {
  if (!unitIds.length) return;
  const members = await tx
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.buildingId, buildingId),
        eq(membership.role, "resident"),
        inArray(membership.unitId, unitIds),
      ),
    );
  for (const m of members)
    await enqueueNotice(tx, {
      buildingId,
      userId: m.userId,
      kind,
      title,
      body,
      href,
      dedupeKey,
    });
}

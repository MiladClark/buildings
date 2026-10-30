import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appNotification,
  notificationDelivery,
  notificationPreference,
  notificationRule,
  pushSubscription,
  scheduledAnnouncement,
  unit,
} from "@/lib/db/schema";
import { requireSession, getMembershipForUser } from "@/lib/session";
import { getPushIdentity } from "./push";
import { readPolicy, readPreferences } from "./policy";
export async function getNotificationPanel() {
  const session = await requireSession(),
    member = await getMembershipForUser(session.user.id);
  if (!member) throw new Error("حساب به ساختمان وصل نیست.");
  const [notices, pref, devices, identity] = await Promise.all([
    db
      .select()
      .from(appNotification)
      .where(eq(appNotification.userId, session.user.id))
      .orderBy(desc(appNotification.createdAt))
      .limit(60),
    db.query.notificationPreference.findFirst({
      where: eq(notificationPreference.userId, session.user.id),
    }),
    db
      .select({
        id: pushSubscription.id,
        name: pushSubscription.deviceName,
        endpoint: pushSubscription.endpoint,
        createdAt: pushSubscription.createdAt,
      })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, session.user.id)),
    getPushIdentity(),
  ]);
  const personal = {
    notices,
    preferences: readPreferences(pref?.settings),
    devices,
    publicKey: identity.publicKey,
    role: member.role,
    buildingId: member.buildingId,
  };
  if (member.role !== "manager") return { ...personal, management: null };
  const [rule, announcements, units, deliveryCounts] = await Promise.all([
    db.query.notificationRule.findFirst({
      where: eq(notificationRule.buildingId, member.buildingId),
    }),
    db
      .select()
      .from(scheduledAnnouncement)
      .where(eq(scheduledAnnouncement.buildingId, member.buildingId))
      .orderBy(desc(scheduledAnnouncement.createdAt))
      .limit(25),
    db
      .select({ id: unit.id, label: unit.label })
      .from(unit)
      .where(
        and(eq(unit.buildingId, member.buildingId), isNull(unit.deletedAt)),
      )
      .orderBy(unit.sortOrder),
    db
      .select({ status: notificationDelivery.status, total: count() })
      .from(notificationDelivery)
      .innerJoin(
        appNotification,
        eq(notificationDelivery.notificationId, appNotification.id),
      )
      .where(eq(appNotification.buildingId, member.buildingId))
      .groupBy(notificationDelivery.status),
  ]);
  return {
    ...personal,
    management: {
      policy: readPolicy(rule?.settings),
      announcements,
      units,
      deliveryCounts,
    },
  };
}
export async function unreadNotificationCount(userId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(appNotification)
    .where(
      and(eq(appNotification.userId, userId), eq(appNotification.read, false)),
    );
  return row.total;
}

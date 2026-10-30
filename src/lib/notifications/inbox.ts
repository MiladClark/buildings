import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appNotification } from "@/lib/db/schema";
import { safeNotificationHref } from "./policy";

const previewLimit = 15;

export async function getNotificationPreview(userId: string) {
  const own = eq(appNotification.userId, userId);
  const unread = and(own, eq(appNotification.read, false));
  const fields = {
    id: appNotification.id,
    title: appNotification.title,
    body: appNotification.body,
    href: appNotification.href,
    read: appNotification.read,
    createdAt: appNotification.createdAt,
  };
  const [all, unreadItems, totals] = await Promise.all([
    db
      .select(fields)
      .from(appNotification)
      .where(own)
      .orderBy(desc(appNotification.createdAt), desc(appNotification.id))
      .limit(previewLimit),
    db
      .select(fields)
      .from(appNotification)
      .where(unread)
      .orderBy(desc(appNotification.createdAt), desc(appNotification.id))
      .limit(previewLimit),
    db.select({ total: count() }).from(appNotification).where(unread),
  ]);
  const serialize = (items: typeof all) =>
    items.map((item) => ({
      ...item,
      href: safeNotificationHref(item.href),
      createdAt: item.createdAt.toISOString(),
    }));
  return {
    all: serialize(all),
    unread: serialize(unreadItems),
    unreadCount: totals[0].total,
  };
}

export type NotificationPreview = Awaited<
  ReturnType<typeof getNotificationPreview>
>;

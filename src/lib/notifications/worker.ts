import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appNotification,
  building,
  expenseDisbursement,
  membership,
  notificationDelivery,
  notificationPreference,
  notificationRule,
  pushSubscription,
  scheduledAnnouncement,
} from "@/lib/db/schema";
import { buildSettlementState } from "@/lib/billing/settlement-state";
import {
  loadSettlementData,
  type LedgerTransaction,
} from "@/lib/billing/settlement-store";
import { buildTreasury } from "@/lib/billing/treasury";
import { formatToman } from "@/lib/format/money";
import { isoDate, formatJalaliDate } from "@/lib/format/jalali";
import {
  afterQuietHours,
  readPolicy,
  readPreferences,
  reminderSlot,
  tehranClock,
  safeNotificationHref,
} from "./policy";
import { enqueueNotice } from "./store";
import { sendWebPush } from "./push";

async function scheduleBuilding(
  tx: LedgerTransaction,
  buildingId: string,
  now: Date,
) {
  const rule = await tx.query.notificationRule.findFirst({
    where: eq(notificationRule.buildingId, buildingId),
  });
  const policy = readPolicy(rule?.settings);
  if (!policy.enabled) return;
  const members = await tx
    .select()
    .from(membership)
    .where(eq(membership.buildingId, buildingId));
  const announcements = await tx
    .select()
    .from(scheduledAnnouncement)
    .where(
      and(
        eq(scheduledAnnouncement.buildingId, buildingId),
        isNull(scheduledAnnouncement.cancelledAt),
        isNull(scheduledAnnouncement.processedAt),
        lte(scheduledAnnouncement.sendAt, now),
      ),
    );
  for (const a of announcements) {
    const [claimed] = await tx
      .update(scheduledAnnouncement)
      .set({ processedAt: now })
      .where(
        and(
          eq(scheduledAnnouncement.id, a.id),
          isNull(scheduledAnnouncement.cancelledAt),
          isNull(scheduledAnnouncement.processedAt),
        ),
      )
      .returning({ id: scheduledAnnouncement.id });
    if (!claimed) continue;
    for (const m of members.filter(
      (m) =>
        a.audience === "all" ||
        (a.audience === "residents" &&
          (m.role === "resident" || (m.role === "manager" && m.unitId))) ||
        (a.audience === "managers" && m.role === "manager") ||
        (a.audience === "unit" && m.unitId === a.unitId),
    ))
      await enqueueNotice(tx, {
        buildingId,
        userId: m.userId,
        kind: "announcement",
        title: a.title,
        body: a.body,
        href: `/${m.role === "manager" ? "manager" : "resident"}/notifications`,
        dedupeKey: `announcement:${a.id}`,
        context: { announcementId: a.id },
        now,
      });
  }
  const time = tehranClock(now);
  if (time.hour * 60 + time.minute < policy.hour * 60 + policy.minute) return;
  const today = isoDate(now);
  const ledger = await loadSettlementData(tx, buildingId);
  const state = buildSettlementState(ledger);
  if (policy.charge_due)
    for (const p of ledger.periods.filter(
      (p) => p.status !== "draft" && p.dueDate,
    )) {
      const due = isoDate(p.dueDate!),
        slot = reminderSlot(
          due,
          today,
          policy.chargeLeadDays,
          policy.overdueEveryDays,
          policy.maxOverdue,
        );
      if (!slot) continue;
      for (const m of members.filter(
        (m) => (m.role === "resident" || m.role === "manager") && m.unitId,
      )) {
        const net =
          state.accounts.find((a) => a.unitId === m.unitId)?.balanceRial ?? 0;
        const debt = state.shares
          .filter(
            (s) => !s.draft && s.periodId === p.id && s.unitId === m.unitId,
          )
          .reduce((s, r) => s + r.balanceRial, 0);
        if (net <= 0 || debt <= 0) continue;
        await enqueueNotice(tx, {
          buildingId,
          userId: m.userId,
          kind: "charge_due",
          title: slot.startsWith("overdue")
            ? "سررسید شارژ گذشته است"
            : "یادآوری پرداخت شارژ",
          body: `${p.title}؛ مانده قابل پرداخت ${formatToman(Math.min(net, debt))}. مهلت: ${formatJalaliDate(p.dueDate!)}.`,
          href: "/resident/invoices",
          dedupeKey: `charge:${p.id}:${due}:${slot}`,
          context: { periodId: p.id, unitId: m.unitId!, dueOn: due },
          now,
        });
      }
    }
  if (policy.bill_due) {
    const history = await tx
      .select()
      .from(expenseDisbursement)
      .where(eq(expenseDisbursement.buildingId, buildingId));
    const treasury = buildTreasury(ledger, history);
    for (const c of treasury.costs.filter(
      (c) => !c.settled && c.remainingRial > 0 && c.utilityBill?.dueOn,
    )) {
      const due = c.utilityBill!.dueOn,
        slot = reminderSlot(
          due,
          today,
          policy.billLeadDays,
          policy.overdueEveryDays,
          policy.maxOverdue,
        );
      if (!slot) continue;
      for (const m of members.filter((m) => m.role === "manager"))
        await enqueueNotice(tx, {
          buildingId,
          userId: m.userId,
          kind: "bill_due",
          title: slot.startsWith("overdue")
            ? "مهلت پرداخت قبض گذشته است"
            : "یادآوری قبض ساختمان",
          body: `${c.title}؛ مانده برآورد ${formatToman(c.remainingRial)}. مهلت: ${formatJalaliDate(new Date(`${due}T12:00:00Z`))}.`,
          href: "/manager/bills",
          dedupeKey: `bill:${c.key}:${due}:${slot}`,
          context: { costKey: c.key, dueOn: due },
          now,
        });
    }
  }
}
async function stillRelevant(
  tx: LedgerTransaction,
  notice: typeof appNotification.$inferSelect,
) {
  if (!notice.buildingId) return true;
  const member = await tx.query.membership.findFirst({
    where: and(
      eq(membership.buildingId, notice.buildingId),
      eq(membership.userId, notice.userId),
    ),
  });
  if (!member) return false;
  const c = notice.context;
  if (c?.announcementId) {
    const a = await tx.query.scheduledAnnouncement.findFirst({
      where: eq(scheduledAnnouncement.id, c.announcementId),
    });
    return !!a && !a.cancelledAt;
  }
  if (notice.kind === "charge_due" && c?.periodId) {
    if (
      !["resident", "manager"].includes(member.role) ||
      member.unitId !== c.unitId
    )
      return false;
    const ledger = await loadSettlementData(tx, notice.buildingId),
      state = buildSettlementState(ledger);
    const p = ledger.periods.find((p) => p.id === c.periodId);
    return (
      !!p &&
      p.status !== "draft" &&
      !!p.dueDate &&
      isoDate(p.dueDate) === c.dueOn &&
      (state.accounts.find((a) => a.unitId === member.unitId)?.balanceRial ??
        0) > 0 &&
      state.shares.some(
        (s) =>
          !s.draft &&
          s.periodId === p.id &&
          s.unitId === member.unitId &&
          s.balanceRial > 0,
      )
    );
  }
  if (notice.kind === "bill_due" && c?.costKey) {
    if (member.role !== "manager") return false;
    const ledger = await loadSettlementData(tx, notice.buildingId);
    const history = await tx
      .select()
      .from(expenseDisbursement)
      .where(eq(expenseDisbursement.buildingId, notice.buildingId));
    const cost = buildTreasury(ledger, history).costs.find(
      (v) => v.key === c.costKey,
    );
    return (
      !!cost &&
      !cost.settled &&
      cost.remainingRial > 0 &&
      cost.utilityBill?.dueOn === c.dueOn
    );
  }
  return true;
}
export async function runNotificationCycle(
  now = new Date(),
  sender: typeof sendWebPush = sendWebPush,
  onlyBuildingId?: string,
) {
  const buildings = await db
    .select({ id: building.id })
    .from(building)
    .where(onlyBuildingId ? eq(building.id, onlyBuildingId) : undefined);
  for (const b of buildings)
    await db.transaction((tx) => scheduleBuilding(tx, b.id, now));
  const pending = await db
    .select({
      delivery: notificationDelivery,
      notice: appNotification,
      subscription: pushSubscription,
    })
    .from(notificationDelivery)
    .innerJoin(
      appNotification,
      eq(notificationDelivery.notificationId, appNotification.id),
    )
    .innerJoin(
      pushSubscription,
      eq(notificationDelivery.subscriptionId, pushSubscription.id),
    )
    .where(
      and(
        eq(notificationDelivery.status, "pending"),
        lte(notificationDelivery.nextAttemptAt, now),
        or(
          isNull(notificationDelivery.leaseUntil),
          lte(notificationDelivery.leaseUntil, now),
        ),
        onlyBuildingId
          ? eq(appNotification.buildingId, onlyBuildingId)
          : undefined,
      ),
    )
    .limit(50);
  let sent = 0,
    failed = 0;
  for (const { delivery: d, notice: n, subscription: s } of pending) {
    const [claimed] = await db
      .update(notificationDelivery)
      .set({
        leaseUntil: new Date(now.getTime() + 120000),
        attempts: sql`${notificationDelivery.attempts}+1`,
      })
      .where(
        and(
          eq(notificationDelivery.id, d.id),
          eq(notificationDelivery.status, "pending"),
          lte(notificationDelivery.nextAttemptAt, now),
          or(
            isNull(notificationDelivery.leaseUntil),
            lte(notificationDelivery.leaseUntil, now),
          ),
        ),
      )
      .returning();
    if (!claimed) continue;
    const pref = readPreferences(
      (
        await db.query.notificationPreference.findFirst({
          where: eq(notificationPreference.userId, n.userId),
        })
      )?.settings,
    );
    const rule = readPolicy(
      (
        await db.query.notificationRule.findFirst({
          where: eq(notificationRule.buildingId, s.buildingId),
        })
      )?.settings,
    );
    if (
      d.expiresAt <= now ||
      n.read ||
      s.userId !== n.userId ||
      s.buildingId !== n.buildingId ||
      !rule.enabled ||
      !rule.pushEnabled ||
      !rule[n.kind] ||
      !pref.pushEnabled ||
      !pref[n.kind] ||
      !(await db.transaction((tx) => stillRelevant(tx, n)))
    ) {
      await db
        .update(notificationDelivery)
        .set({ status: "cancelled", leaseUntil: null })
        .where(eq(notificationDelivery.id, d.id));
      continue;
    }
    const afterQuiet = afterQuietHours(now, pref);
    if (afterQuiet > now) {
      await db
        .update(notificationDelivery)
        .set({
          nextAttemptAt: afterQuiet,
          leaseUntil: null,
          attempts: d.attempts,
        })
        .where(eq(notificationDelivery.id, d.id));
      continue;
    }
    try {
      await sender(
        { endpoint: s.endpoint, keys: s.keys },
        {
          title: n.title,
          body: pref.showDetails
            ? n.body
            : "پیام تازه‌ای در واحدبان دارید. برای مشاهده جزئیات وارد حساب شوید.",
          url: safeNotificationHref(n.href),
          tag: n.id,
        },
      );
      await db
        .update(notificationDelivery)
        .set({ status: "sent", sentAt: now, leaseUntil: null, lastError: null })
        .where(eq(notificationDelivery.id, d.id));
      sent++;
    } catch (error) {
      const status =
        typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscription).where(eq(pushSubscription.id, s.id));
        failed++;
        continue;
      }
      const terminal =
        claimed.attempts >= 5 ||
        (status >= 400 && status < 500 && status !== 429);
      await db
        .update(notificationDelivery)
        .set({
          status: terminal ? "failed" : "pending",
          leaseUntil: null,
          lastError: status ? `PUSH_HTTP_${status}` : "PUSH_UNAVAILABLE",
          nextAttemptAt: new Date(
            now.getTime() + Math.min(3600000, 60000 * 2 ** claimed.attempts),
          ),
        })
        .where(eq(notificationDelivery.id, d.id));
      failed++;
    }
  }
  return { sent, failed };
}

const globalWorker = globalThis as typeof globalThis & {
  notificationTimer?: ReturnType<typeof setInterval>;
  notificationBusy?: boolean;
};
export function startNotificationWorker() {
  if (globalWorker.notificationTimer) return;
  const tick = async () => {
    if (globalWorker.notificationBusy) return;
    globalWorker.notificationBusy = true;
    try {
      await runNotificationCycle();
    } catch {
      console.error("Notification worker: cycle failed; retrying next minute.");
    } finally {
      globalWorker.notificationBusy = false;
    }
  };
  globalWorker.notificationTimer = setInterval(() => void tick(), 60000);
  globalWorker.notificationTimer.unref();
  void tick();
}

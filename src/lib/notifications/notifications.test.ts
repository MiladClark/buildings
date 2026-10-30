import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq, sql } from "drizzle-orm";
vi.mock("@/lib/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  const client = new PGlite();
  return { db: drizzle(client, { schema }), client };
});
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { enqueueNotice } from "./store";
import { runNotificationCycle } from "./worker";
import { defaultPolicy, defaultPreferences } from "./types";
import {
  afterQuietHours,
  reminderSlot,
  tehranClock,
  safeNotificationHref,
} from "./policy";
import { encodePushPayload, getPushIdentity, validPushEndpoint } from "./push";
import {
  parseUtilityBill,
  utilityBillFromForm,
} from "@/lib/billing/utility-bill";
import {
  saveStandaloneCost,
  includeStandaloneCost,
} from "@/lib/billing/standalone-expenses";

const at = (text: string) => new Date(`2026-10-30T${text}:00+03:30`);
const now = at("09:00");
const sender = () =>
  vi
    .fn<typeof import("./push").sendWebPush>()
    .mockResolvedValue({ statusCode: 201, headers: {}, body: "" });
beforeAll(async () => {
  const { client } = (await import("@/lib/db")) as unknown as {
    client: import("@electric-sql/pglite").PGlite;
  };
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle/postgresql" });
});
afterAll(async () => {
  const { client } = (await import("@/lib/db")) as unknown as {
    client: import("@electric-sql/pglite").PGlite;
  };
  await client.close();
});
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE "user",building CASCADE`);
  await db.insert(s.building).values([
    { id: "b", name: "آزمایش" },
    { id: "other", name: "دیگر" },
  ]);
  await db.insert(s.user).values([
    { id: "m", name: "مدیر", email: "m@test.local" },
    { id: "r", name: "ساکن", email: "r@test.local" },
    { id: "o", name: "دیگر", email: "o@test.local" },
  ]);
  await db
    .insert(s.unit)
    .values({ id: "u", buildingId: "b", label: "۱", occupantCount: 2 });
  await db.insert(s.membership).values([
    { id: "mm", userId: "m", buildingId: "b", role: "manager" },
    { id: "mr", userId: "r", buildingId: "b", unitId: "u", role: "resident" },
    { id: "mo", userId: "o", buildingId: "other", role: "resident" },
  ]);
  await db.insert(s.expenseCategory).values({
    id: "cat",
    buildingId: "b",
    name: "آب",
    slug: "water",
    allocationMethod: "per_unit",
  });
  await db.insert(s.billingPeriod).values({
    id: "p",
    buildingId: "b",
    title: "شارژ آزمایشی",
    periodType: "monthly",
    startDate: new Date("2026-10-01"),
    endDate: new Date("2026-10-30"),
    dueDate: new Date("2099-10-31"),
    status: "finalized",
  });
  await db.insert(s.expenseLine).values({
    id: "cost",
    periodId: "p",
    categoryId: "cat",
    amountRial: 100000,
    expenseDate: now,
    utilityBill: parseUtilityBill({ kind: "water", dueOn: "2099-10-31" }),
  });
  await db.insert(s.unitInvoice).values({
    id: "invoice",
    periodId: "p",
    unitId: "u",
    subtotalRial: 100000,
    totalRial: 100000,
    balanceRial: 100000,
  });
  await db.insert(s.invoiceLineItem).values({
    id: "line",
    invoiceId: "invoice",
    categoryId: "cat",
    title: "آب",
    amountRial: 100000,
  });
  for (const userId of ["m", "r"])
    await db.insert(s.pushSubscription).values({
      id: `sub-${userId}`,
      userId,
      buildingId: "b",
      endpoint: `https://fcm.googleapis.com/fcm/send/test-${userId}`,
      keys: { p256dh: "test", auth: "test" },
      deviceName: "آزمایشی",
    });
});
async function notice(userId = "r", key?: string) {
  return db.transaction((tx) =>
    enqueueNotice(tx, {
      buildingId: "b",
      userId,
      kind: "system",
      title: "خبر",
      body: "اطلاعات حساب",
      href: "/resident/notifications",
      dedupeKey: key,
      now,
    }),
  );
}
async function dueTomorrow() {
  await db
    .update(s.billingPeriod)
    .set({ dueDate: new Date("2026-10-31T12:00:00Z") })
    .where(eq(s.billingPeriod.id, "p"));
  await db
    .update(s.expenseLine)
    .set({
      utilityBill: parseUtilityBill({ kind: "water", dueOn: "2026-10-31" }),
    })
    .where(eq(s.expenseLine.id, "cost"));
}

describe("notification ledger and delivery", () => {
  it("commits the inbox and one delivery per device atomically, deduplicated per user", async () => {
    await notice("r", "event:one");
    await notice("r", "event:one");
    await notice("m", "event:one");
    expect(await db.select().from(s.appNotification)).toHaveLength(2);
    expect(await db.select().from(s.notificationDelivery)).toHaveLength(2);
  });
  it("never creates notifications for a user outside the building", async () => {
    expect(await notice("o")).toBeNull();
    expect(await db.select().from(s.appNotification)).toHaveLength(0);
  });
  it("honors global and personal event opt-outs", async () => {
    await db.insert(s.notificationRule).values({
      buildingId: "b",
      settings: { ...defaultPolicy, system: false },
    });
    expect(await notice()).toBeNull();
    await db.update(s.notificationRule).set({ settings: defaultPolicy });
    await db.insert(s.notificationPreference).values({
      userId: "r",
      settings: { ...defaultPreferences, system: false },
    });
    expect(await notice()).toBeNull();
  });
  it("keeps an inbox when push is disabled, without creating a push delivery", async () => {
    await db.insert(s.notificationPreference).values({
      userId: "r",
      settings: { ...defaultPreferences, pushEnabled: false },
    });
    expect(await notice()).toBeTruthy();
    expect(await db.select().from(s.notificationDelivery)).toHaveLength(0);
  });
  it("delivers once and omits private message detail by default", async () => {
    await notice();
    const send = sender();
    await runNotificationCycle(now, send);
    await runNotificationCycle(now, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1].body).not.toContain("اطلاعات حساب");
    expect((await db.select().from(s.notificationDelivery))[0].status).toBe(
      "sent",
    );
  });
  it("defers delivery during overnight quiet hours without losing the inbox", async () => {
    await db.transaction((tx) =>
      enqueueNotice(tx, {
        buildingId: "b",
        userId: "r",
        kind: "system",
        title: "شب",
        body: "پیام",
        href: "/resident/notifications",
        now: at("23:00"),
      }),
    );
    const send = sender();
    await runNotificationCycle(at("23:01"), send);
    expect(send).not.toHaveBeenCalled();
    expect(
      (
        await db.select().from(s.notificationDelivery)
      )[0].nextAttemptAt.toISOString(),
    ).toBe("2026-10-31T04:30:00.000Z");
    await runNotificationCycle(new Date("2026-10-31T08:00:00+03:30"), send);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("cancels queued messages already read or subsequently opted out", async () => {
    const id = await notice();
    await db
      .update(s.appNotification)
      .set({ read: true })
      .where(eq(s.appNotification.id, id!));
    const send = sender();
    await runNotificationCycle(now, send);
    expect(send).not.toHaveBeenCalled();
    expect((await db.select().from(s.notificationDelivery))[0].status).toBe(
      "cancelled",
    );
  });
  it("does not send a leased delivery through another worker", async () => {
    await notice();
    await db
      .update(s.notificationDelivery)
      .set({ leaseUntil: new Date(now.getTime() + 60000) });
    const send = sender();
    await runNotificationCycle(now, send);
    expect(send).not.toHaveBeenCalled();
    await runNotificationCycle(new Date(now.getTime() + 61000), send);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("backs off transient failures, retries and retains delivery history", async () => {
    await notice();
    const fail = vi.fn(async () => {
      throw new Error("network");
    });
    await runNotificationCycle(now, fail);
    const d = (await db.select().from(s.notificationDelivery))[0];
    expect(d.status).toBe("pending");
    expect(d.attempts).toBe(1);
    await runNotificationCycle(now, fail);
    expect(fail).toHaveBeenCalledTimes(1);
    const send = sender();
    await runNotificationCycle(d.nextAttemptAt, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await db.select().from(s.notificationDelivery))[0].attempts).toBe(
      2,
    );
  });
  it("removes expired subscriptions when the provider returns 410", async () => {
    await notice();
    await runNotificationCycle(now, async () => {
      throw { statusCode: 410 };
    });
    expect(
      (await db.select().from(s.pushSubscription)).some(
        (v) => v.id === "sub-r",
      ),
    ).toBe(false);
    expect(await db.select().from(s.appNotification)).toHaveLength(1);
  });
  it("never delivers an old user's queued payload after a device is reassigned", async () => {
    await notice();
    await db
      .update(s.pushSubscription)
      .set({ userId: "m" })
      .where(eq(s.pushSubscription.id, "sub-r"));
    const send = sender();
    await runNotificationCycle(now, send);
    expect(send).not.toHaveBeenCalled();
  });
});
describe("scheduled financial reminders", () => {
  it("sends charge reminders to the resident and bill reminders only to managers, once per slot", async () => {
    await dueTomorrow();
    const send = sender();
    await runNotificationCycle(now, send);
    await runNotificationCycle(now, send);
    const rows = await db.select().from(s.appNotification);
    expect(rows).toHaveLength(2);
    expect(rows.find((n) => n.kind === "charge_due")?.userId).toBe("r");
    expect(rows.find((n) => n.kind === "bill_due")?.userId).toBe("m");
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("uses Tehran's scheduled time instead of UTC and never reminds before it", async () => {
    await dueTomorrow();
    const send = sender();
    await runNotificationCycle(at("08:59"), send);
    expect(await db.select().from(s.appNotification)).toHaveLength(0);
    await runNotificationCycle(now, send);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("does not send charge reminders when free credit covers the debt", async () => {
    await dueTomorrow();
    await db.insert(s.payment).values({
      id: "credit",
      buildingId: "b",
      unitId: "u",
      amountRial: 100000,
      allocationTracked: true,
      method: "cash",
      paidAt: now,
    });
    await runNotificationCycle(now, sender());
    expect(
      (await db.select().from(s.appNotification)).filter(
        (n) => n.kind === "charge_due",
      ),
    ).toHaveLength(0);
  });
  it("suppresses a queued charge reminder settled before quiet hours finish", async () => {
    await dueTomorrow();
    await db.insert(s.notificationPreference).values({
      userId: "r",
      settings: { ...defaultPreferences, quietStart: 8, quietEnd: 10 },
    });
    await runNotificationCycle(now, sender());
    await db.insert(s.payment).values({
      id: "credit",
      buildingId: "b",
      unitId: "u",
      amountRial: 100000,
      allocationTracked: true,
      method: "cash",
      paidAt: now,
    });
    const send = sender();
    await runNotificationCycle(at("10:00"), send);
    expect(send).not.toHaveBeenCalled();
    const row = (await db.select().from(s.appNotification)).find(
      (n) => n.kind === "charge_due",
    )!;
    expect(
      (await db.select().from(s.notificationDelivery)).find(
        (d) => d.notificationId === row.id,
      )?.status,
    ).toBe("cancelled");
  });
  it("stops reminders after a real final payment and resumes after cancellation", async () => {
    await dueTomorrow();
    await db.insert(s.expenseDisbursement).values({
      id: "paid",
      buildingId: "b",
      expenseId: "cost",
      amountRial: 90000,
      payee: "آبفا",
      paidAt: now,
      method: "bank_transfer",
      finalPayment: true,
    });
    await runNotificationCycle(now, sender());
    expect(
      (await db.select().from(s.appNotification)).some(
        (n) => n.kind === "bill_due",
      ),
    ).toBe(false);
    await db
      .update(s.expenseDisbursement)
      .set({ cancelledAt: now })
      .where(eq(s.expenseDisbursement.id, "paid"));
    await runNotificationCycle(now, sender());
    expect(
      (await db.select().from(s.appNotification)).some(
        (n) => n.kind === "bill_due",
      ),
    ).toBe(true);
  });
  it("delivers a scheduled unit announcement once, excluding other buildings", async () => {
    await db.insert(s.scheduledAnnouncement).values({
      id: "a",
      buildingId: "b",
      title: "تعمیر",
      body: "اطلاع ساختمان",
      audience: "unit",
      unitId: "u",
      sendAt: now,
    });
    await runNotificationCycle(at("08:59"), sender());
    expect(await db.select().from(s.appNotification)).toHaveLength(0);
    await runNotificationCycle(now, sender());
    await runNotificationCycle(now, sender());
    const rows = await db.select().from(s.appNotification);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("r");
  });
  it("does not deliver cancelled scheduled messages", async () => {
    await db.insert(s.scheduledAnnouncement).values({
      id: "a",
      buildingId: "b",
      title: "لغو",
      body: "اطلاع",
      audience: "all",
      sendAt: now,
      cancelledAt: now,
    });
    const send = sender();
    await runNotificationCycle(now, send);
    expect(send).not.toHaveBeenCalled();
    expect(await db.select().from(s.appNotification)).toHaveLength(0);
  });
});
describe("time, identifiers and utility records", () => {
  it("encrypts long Persian announcements within the web push payload limit", async () => {
    const { createECDH, randomBytes } = await import("node:crypto");
    const webpush = (await import("web-push")).default;
    const device = createECDH("prime256v1");
    const publicKey = device.generateKeys().toString("base64url");
    const payload = encodePushPayload({
      title: "اعلان ساختمان",
      body: 'پیام فارسی با علامت " و شکلک 🏡 '.repeat(200),
      url: "/resident/notifications",
      tag: "notice-test",
    });
    expect(Buffer.byteLength(payload, "utf8")).toBeLessThanOrEqual(3500);
    expect(JSON.parse(payload).body).toMatch(/…$/);
    const identity = await getPushIdentity();
    const request = webpush.generateRequestDetails(
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/test",
        keys: {
          p256dh: publicKey,
          auth: randomBytes(16).toString("base64url"),
        },
      },
      payload,
      {
        vapidDetails: {
          subject: identity.subject,
          publicKey: identity.publicKey,
          privateKey: identity.privateKey,
        },
      },
    );
    expect(request.body?.length).toBeLessThan(4096);
    expect(request.headers.Authorization).toContain("vapid");
  });
  it("handles midnight quiet periods and bounded overdue repetitions", () => {
    expect(tehranClock(new Date("2026-10-29T21:00:00Z"))).toEqual({
      hour: 0,
      minute: 30,
    });
    expect(
      afterQuietHours(at("09:00"), {
        ...defaultPreferences,
        quietStart: 9,
        quietEnd: 9,
      }),
    ).toEqual(at("09:00"));
    expect(reminderSlot("2026-10-30", "2026-11-06", [3, 1, 0], 7, 3)).toBe(
      "overdue:1",
    );
    expect(
      reminderSlot("2026-10-30", "2026-11-27", [3, 1, 0], 7, 3),
    ).toBeNull();
  });
  it("validates real calendar dates and period order, and preserves leading zero IDs", () => {
    expect(() =>
      parseUtilityBill({ kind: "water", dueOn: "2026-99-99" }),
    ).toThrow("تاریخ قبض");
    expect(() =>
      parseUtilityBill({
        kind: "water",
        periodStart: "2026-10-30",
        periodEnd: "2026-09-30",
      }),
    ).toThrow("قرائت فعلی");
    expect(parseUtilityBill({ kind: "water", billId: "000123" })?.billId).toBe(
      "000123",
    );
  });
  it("accepts Persian bill digits and converts descriptive toman amounts exactly once", () => {
    const f = new FormData();
    f.set("hasUtilityBill", "on");
    f.set("bill_kind", "water");
    f.set("bill_billId", "۰۰۰۱۲۳");
    f.set("bill_previousDebt", "۱۲٬۰۰۰");
    expect(utilityBillFromForm(f)).toMatchObject({
      billId: "000123",
      previousDebtRial: 120000,
    });
  });
  it("keeps utility metadata when moving an independent cost into billing", async () => {
    await db
      .update(s.billingPeriod)
      .set({ status: "draft" })
      .where(eq(s.billingPeriod.id, "p"));
    const bill = parseUtilityBill({
      kind: "electricity",
      billId: "000123",
      dueOn: "2026-11-02",
    })!;
    const id = await db.transaction((tx) =>
      saveStandaloneCost(
        tx,
        "b",
        {
          categoryId: "cat",
          description: "برق",
          amountRial: 200000,
          expenseDate: now,
          utilityBill: bill,
        },
        "m",
      ),
    );
    await db.transaction((tx) => includeStandaloneCost(tx, "b", id, "p", "m"));
    const source = await db.query.standaloneExpense.findFirst({
      where: eq(s.standaloneExpense.id, id),
    });
    const linked = await db.query.expenseLine.findFirst({
      where: eq(s.expenseLine.id, source!.linkedExpenseId!),
    });
    expect(linked?.utilityBill).toEqual(bill);
  });
  it("retains the server's signing identity rather than rotating it on page loads", async () => {
    const first = await getPushIdentity(),
      second = await getPushIdentity();
    expect(second.publicKey).toBe(first.publicKey);
    expect(second.privateKey).toBe(first.privateKey);
    expect(first.publicKey.length).toBeGreaterThan(80);
  });
  it("rejects supplied push endpoints outside known providers and external click targets", () => {
    expect(validPushEndpoint("https://fcm.googleapis.com/fcm/send/a")).toBe(
      true,
    );
    expect(validPushEndpoint("https://127.0.0.1/admin")).toBe(false);
    expect(validPushEndpoint("https://fcm.googleapis.com.evil.test/a")).toBe(
      false,
    );
    expect(validPushEndpoint("http://web.push.apple.com/a")).toBe(false);
    expect(safeNotificationHref("//evil.test")).toBe("/");
    expect(safeNotificationHref("/manager/bills")).toBe("/manager/bills");
  });
});

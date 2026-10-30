import { and, eq, gt, ne } from "drizzle-orm";
import {
  account,
  appNotification,
  chatMessage,
  expenseDisbursement,
  maintenanceTicket,
  managementEvent,
  membership,
  payment,
  paymentRequest,
  rateAdjustment,
  session,
  user,
} from "@/lib/db/schema";
import type { LedgerTransaction } from "@/lib/billing/settlement-store";
import { normalizeIranMobile, phoneToAuthEmail } from "@/lib/auth/phone";
import { logManagementEvent } from "@/lib/billing/corrections";

async function activeAccount(
  tx: LedgerTransaction,
  userId: string,
  currentSessionId: string,
) {
  const person = await tx.query.user.findFirst({ where: eq(user.id, userId) });
  const login = await tx.query.session.findFirst({
    where: and(
      eq(session.id, currentSessionId),
      eq(session.userId, userId),
      gt(session.expiresAt, new Date()),
    ),
  });
  const member = await tx.query.membership.findFirst({
    where: eq(membership.userId, userId),
  });
  if (!person || !login || !member)
    throw new Error("ابتدا دوباره وارد حساب شوید.");
  return { person, member };
}
export async function updateAccountProfile(
  tx: LedgerTransaction,
  userId: string,
  currentSessionId: string,
  input: { name: string; phone: string },
) {
  const name = input.name.trim();
  if (!name || name.length > 120)
    throw new Error("نام را بین ۱ تا ۱۲۰ کاراکتر وارد کنید.");
  const phone = input.phone.trim() ? normalizeIranMobile(input.phone) : null;
  const { person, member } = await activeAccount(tx, userId, currentSessionId);
  if (!phone && person.phone)
    throw new Error("برای تغییر شماره، شماره جدید را وارد کنید.");
  let nextEmail = person.email;
  if (phone && phone !== person.phone) {
    const matches = await tx.query.user.findMany({
      where: (u, { or, eq }) =>
        or(eq(u.phone, phone), eq(u.email, phoneToAuthEmail(phone))),
    });
    const otherPeople = matches.filter((u) => u.id !== userId);
    if (otherPeople.length > 1)
      throw new Error(
        "شماره به چند حساب وصل است؛ اطلاعات حساب‌ها را بررسی کنید.",
      );
    const target = otherPeople[0];
    if (target) {
      const targetMembers = await tx.query.membership.findMany({
        where: eq(membership.userId, target.id),
      });
      const targetMember = targetMembers[0];
      if (
        member.role !== "manager" ||
        targetMembers.length !== 1 ||
        targetMember.buildingId !== member.buildingId ||
        targetMember.role !== "resident" ||
        (member.unitId &&
          targetMember.unitId &&
          member.unitId !== targetMember.unitId)
      )
        throw new Error(
          "این شماره به حساب دیگری وصل است؛ نقش همان حساب را از فهرست حساب‌ها تغییر دهید.",
        );
      const identities = await tx.query.account.findMany({
        where: eq(account.userId, target.id),
      });
      if (identities.some((a) => a.password || a.providerId !== "credential"))
        throw new Error(
          "این شماره حساب فعال جدا دارد؛ نقش همان حساب را از فهرست حساب‌ها تغییر دهید.",
        );
      // Reconcile an unused resident shell with the manager's email account.
      // Never copy another active person's credentials into a manager's identity.
      await tx
        .update(paymentRequest)
        .set({ userId })
        .where(eq(paymentRequest.userId, target.id));
      await tx
        .update(appNotification)
        .set({ userId })
        .where(eq(appNotification.userId, target.id));
      await tx
        .update(chatMessage)
        .set({ userId })
        .where(eq(chatMessage.userId, target.id));
      await tx
        .update(payment)
        .set({ recordedByUserId: userId })
        .where(eq(payment.recordedByUserId, target.id));
      await tx
        .update(expenseDisbursement)
        .set({ recordedByUserId: userId })
        .where(eq(expenseDisbursement.recordedByUserId, target.id));
      await tx
        .update(rateAdjustment)
        .set({ adjustedByUserId: userId })
        .where(eq(rateAdjustment.adjustedByUserId, target.id));
      await tx
        .update(maintenanceTicket)
        .set({ createdBy: userId })
        .where(eq(maintenanceTicket.createdBy, target.id));
      await tx
        .update(managementEvent)
        .set({ actorId: userId })
        .where(eq(managementEvent.actorId, target.id));
      if (!member.unitId && targetMember.unitId)
        await tx
          .update(membership)
          .set({ unitId: targetMember.unitId })
          .where(eq(membership.id, member.id));
      await tx.delete(session).where(eq(session.userId, target.id));
      await tx.delete(membership).where(eq(membership.userId, target.id));
      await tx.delete(user).where(eq(user.id, target.id));
      await logManagementEvent(
        tx,
        member.buildingId,
        userId,
        "profile",
        userId,
        "merge",
        "اتصال شماره به حساب کاربری",
        { mergedUserId: target.id },
        { canonicalUserId: userId, phone },
      );
    }
    if (nextEmail.endsWith("@residents.internal"))
      nextEmail = phoneToAuthEmail(phone);
  }
  await tx
    .update(user)
    .set({ name, phone, email: nextEmail, updatedAt: new Date() })
    .where(eq(user.id, userId));
  await logManagementEvent(
    tx,
    member.buildingId,
    userId,
    "profile",
    userId,
    "edit",
    "تنظیمات حساب کاربری",
    { name: person.name, phone: person.phone },
    { name, phone },
  );
  return member.buildingId;
}
export async function setOwnAccountPassword(
  tx: LedgerTransaction,
  userId: string,
  currentSessionId: string,
  passwordHash: string,
) {
  const { member } = await activeAccount(tx, userId, currentSessionId);
  if (!passwordHash) throw new Error("رمز را وارد کنید.");
  const credential = await tx.query.account.findFirst({
    where: and(
      eq(account.userId, userId),
      eq(account.providerId, "credential"),
    ),
  });
  if (credential)
    await tx
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(account.id, credential.id));
  else
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await tx
    .delete(session)
    .where(and(eq(session.userId, userId), ne(session.id, currentSessionId)));
  await logManagementEvent(
    tx,
    member.buildingId,
    userId,
    "profile",
    userId,
    "password",
    "ذخیره رمز حساب کاربری",
  );
}

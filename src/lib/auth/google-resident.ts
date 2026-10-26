import { randomBytes } from "node:crypto";
import { and, eq, gt, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { account, membership, session, unit, user } from "@/lib/db/schema";
import {
  claimedDisplayName,
  claimedUnitId,
  joinedPersonName,
  normalizeIranMobile,
  phoneToAuthEmail,
} from "./phone";

export class ResidentConnectionError extends Error {
  constructor(
    public code:
      "NOT_MATCHED" | "USE_PASSWORD" | "ALREADY_LINKED" | "GOOGLE_REQUIRED",
    message: string,
  ) {
    super(message);
  }
}

const noMatch = () =>
  new ResidentConnectionError(
    "NOT_MATCHED",
    "شماره تلفن و واحد با اطلاعات ثبت‌شده توسط مدیر مطابقت ندارد. از مدیر بخواهید هر دو را بررسی کند.",
  );

/** Only an authenticated Google identity can claim an unused, exact resident shell. */
export async function connectGoogleResident(input: {
  userId: string;
  sessionToken: string;
  phone: string;
  unitId: string;
  firstName?: string;
  lastName?: string;
}) {
  const phone = normalizeIranMobile(input.phone);
  const typedName = joinedPersonName(
    input.firstName ?? "",
    input.lastName ?? "",
  );
  if (typedName.length > 120)
    throw new Error("نام و نام خانوادگی بیش از حد طولانی است.");
  if (!input.unitId.trim()) throw noMatch();
  return db.transaction(async (tx) => {
    const current = await tx.query.user.findFirst({
      where: eq(user.id, input.userId),
    });
    const currentSession = await tx.query.session.findFirst({
      where: and(
        eq(session.token, input.sessionToken),
        eq(session.userId, input.userId),
        gt(session.expiresAt, new Date()),
      ),
    });
    const identities = await tx.query.account.findMany({
      where: eq(account.userId, input.userId),
    });
    const google = identities.find(
      (identity) => identity.providerId === "google",
    );
    if (!current || !currentSession || !google || !current.emailVerified) {
      throw new ResidentConnectionError(
        "GOOGLE_REQUIRED",
        "ابتدا با حساب گوگل وارد شوید.",
      );
    }
    const currentMember = await tx.query.membership.findFirst({
      where: eq(membership.userId, current.id),
    });
    if (currentMember) {
      if (
        currentMember.role === "resident" &&
        current.phone === phone &&
        currentMember.unitId === input.unitId
      )
        return { user: current, session: currentSession };
      throw new ResidentConnectionError(
        "ALREADY_LINKED",
        "این حساب قبلاً به ساختمان متصل شده است.",
      );
    }
    // Never move credentials or another provider from an already active identity.
    if (identities.length !== 1)
      throw new ResidentConnectionError(
        "USE_PASSWORD",
        "برای اتصال گوگل، ابتدا با رمز حساب فعلی وارد شوید.",
      );
    const target = await tx.query.user.findFirst({
      where: or(eq(user.phone, phone), eq(user.email, phoneToAuthEmail(phone))),
    });
    if (!target || target.id === current.id) throw noMatch();
    const member = await tx.query.membership.findFirst({
      where: eq(membership.userId, target.id),
    });
    if (!member || member.role !== "resident") throw noMatch();
    let resolvedUnit = "";
    try {
      resolvedUnit = claimedUnitId(true, input.unitId, member.unitId) ?? "";
    } catch {
      throw noMatch();
    }
    const selected = await tx.query.unit.findFirst({
      where: eq(unit.id, resolvedUnit),
    });
    if (
      !selected ||
      selected.deletedAt ||
      selected.buildingId !== member.buildingId
    )
      throw noMatch();
    if (member.unitId !== resolvedUnit) {
      await tx
        .update(membership)
        .set({ unitId: resolvedUnit })
        .where(eq(membership.id, member.id));
    }
    const activeAccounts = await tx.query.account.findMany({
      where: eq(account.userId, target.id),
    });
    if (
      activeAccounts.some(
        (identity) => identity.providerId !== "credential" || identity.password,
      )
    ) {
      throw new ResidentConnectionError(
        "USE_PASSWORD",
        "این حساب قبلاً فعال شده است. برای اتصال گوگل، ابتدا با رمز حساب فعلی وارد شوید.",
      );
    }
    // Preserve the manager's canonical user id and every membership/history reference.
    // Rotate the authenticated session instead of granting access to an old token.
    await tx
      .update(account)
      .set({ userId: target.id, updatedAt: new Date() })
      .where(eq(account.id, google.id));
    const [nextSession] = await tx
      .update(session)
      .set({
        userId: target.id,
        token: randomBytes(32).toString("base64url"),
        updatedAt: new Date(),
      })
      .where(eq(session.id, currentSession.id))
      .returning();
    await tx.delete(user).where(eq(user.id, current.id));
    const [nextUser] = await tx
      .update(user)
      .set({
        name: claimedDisplayName(typedName, target.name),
        email: current.email,
        emailVerified: true,
        phone,
        image: current.image,
        updatedAt: new Date(),
      })
      .where(eq(user.id, target.id))
      .returning();
    return { user: nextUser, session: nextSession };
  });
}

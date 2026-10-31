import { and, eq, ne } from "drizzle-orm";
import { account, membership, session, unit, user } from "@/lib/db/schema";
import type { LedgerTransaction } from "@/lib/billing/settlement-store";
import { logManagementEvent } from "@/lib/billing/corrections";
import { normalizeIranMobile, phoneToAuthEmail } from "@/lib/auth/phone";

export type BuildingRole = "manager" | "resident";
export async function managerMembership(
  tx: LedgerTransaction,
  actorId: string,
) {
  const actor = await tx.query.membership.findFirst({
    where: and(eq(membership.userId, actorId), eq(membership.role, "manager")),
  });
  if (!actor) throw new Error("دسترسی مدیریت ندارید.");
  return actor;
}
async function validUnit(
  tx: LedgerTransaction,
  buildingId: string,
  unitId: string | null,
) {
  if (!unitId) return;
  const chosen = await tx.query.unit.findFirst({
    where: and(eq(unit.id, unitId), eq(unit.buildingId, buildingId)),
  });
  if (!chosen || chosen.deletedAt)
    throw new Error("واحد معتبر از همین ساختمان انتخاب کنید.");
}

/** Managers can open their own unit's resident panel without changing identity. */
export async function setManagerUnit(
  tx: LedgerTransaction,
  actorId: string,
  unitId: string | null,
) {
  const actor = await managerMembership(tx, actorId);
  await validUnit(tx, actor.buildingId, unitId);
  if (unitId && unitId !== actor.unitId) {
    const assigned = await tx.query.membership.findFirst({
      where: and(
        eq(membership.buildingId, actor.buildingId),
        eq(membership.unitId, unitId),
        ne(membership.userId, actorId),
      ),
    });
    if (assigned)
      throw new Error(
        "این واحد حساب دارد؛ از «اتصال حساب شماره‌ایِ واحد من» برای وصل کردن حساب خودتان استفاده کنید.",
      );
  }
  await tx
    .update(membership)
    .set({ unitId })
    .where(eq(membership.id, actor.id));
  await logManagementEvent(
    tx,
    actor.buildingId,
    actorId,
    "membership",
    actor.id,
    "edit",
    "انتخاب واحد مدیر",
    { unitId: actor.unitId },
    { unitId },
  );
  return actor.buildingId;
}
export async function changeBuildingRole(
  tx: LedgerTransaction,
  actorId: string,
  memberId: string,
  role: BuildingRole,
  unitId: string | null,
  passwordHash?: string,
  phoneInput?: string,
) {
  const actor = await managerMembership(tx, actorId);
  if (!["manager", "resident"].includes(role))
    throw new Error("نقش معتبر نیست.");
  const target = await tx.query.membership.findFirst({
    where: and(
      eq(membership.id, memberId),
      eq(membership.buildingId, actor.buildingId),
    ),
  });
  if (!target) throw new Error("حساب این ساختمان پیدا نشد.");
  if (phoneInput?.trim()) {
    const phone = normalizeIranMobile(phoneInput);
    const matches = await tx.query.user.findMany({
      where: (u, { or, eq }) =>
        or(eq(u.phone, phone), eq(u.email, phoneToAuthEmail(phone))),
    });
    if (matches.some((u) => u.id !== target.userId))
      throw new Error(
        "این شماره حساب دیگری دارد؛ نقش همان حساب را تغییر دهید.",
      );
    const person = await tx.query.user.findFirst({
      where: eq(user.id, target.userId),
    });
    await tx
      .update(user)
      .set({
        phone,
        ...(person?.email.endsWith("@residents.internal")
          ? { email: phoneToAuthEmail(phone) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(user.id, target.userId));
  }
  await validUnit(tx, actor.buildingId, unitId);
  if (target.role === "manager" && role !== "manager") {
    const managers = await tx
      .select()
      .from(membership)
      .where(
        and(
          eq(membership.buildingId, actor.buildingId),
          eq(membership.role, "manager"),
        ),
      );
    if (managers.length <= 1)
      throw new Error("دسترسی آخرین مدیر ساختمان قابل حذف نیست.");
    if (target.userId === actorId)
      throw new Error("نقش مدیریتی خودتان را از این بخش نمی‌توانید بردارید.");
  }
  const identities = await tx.query.account.findMany({
    where: eq(account.userId, target.userId),
  });
  if (
    role === "manager" &&
    !identities.some((a) => a.password || a.providerId !== "credential")
  ) {
    if (!passwordHash) throw new Error("برای مدیر جدید، رمز ورود تعیین کنید.");
    const credential = identities.find((a) => a.providerId === "credential");
    if (credential)
      await tx
        .update(account)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(account.id, credential.id));
    else
      await tx.insert(account).values({
        id: crypto.randomUUID(),
        userId: target.userId,
        accountId: target.userId,
        providerId: "credential",
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
  }
  await tx
    .update(membership)
    .set({ role, unitId })
    .where(eq(membership.id, target.id));
  if (target.role === "manager" && role !== "manager")
    await tx.delete(session).where(eq(session.userId, target.userId));
  await logManagementEvent(
    tx,
    actor.buildingId,
    actorId,
    "membership",
    target.id,
    "role",
    "تغییر دسترسی حساب",
    { role: target.role, unitId: target.unitId },
    { role, unitId },
  );
}

export async function addBuildingAccount(
  tx: LedgerTransaction,
  actorId: string,
  input: {
    phone: string;
    name: string;
    role: BuildingRole;
    unitId: string | null;
    passwordHash?: string;
  },
) {
  const actor = await managerMembership(tx, actorId);
  const phone = normalizeIranMobile(input.phone);
  if (!["manager", "resident"].includes(input.role) || input.name.length > 120)
    throw new Error("اطلاعات حساب معتبر نیست.");
  if (input.role === "resident" && !input.unitId)
    throw new Error("واحد ساکن را انتخاب کنید.");
  await validUnit(tx, actor.buildingId, input.unitId);
  const people = await tx.query.user.findMany({
    where: (u, { or, eq }) =>
      or(eq(u.phone, phone), eq(u.email, phoneToAuthEmail(phone))),
  });
  if (people.length > 1)
    throw new Error(
      "شماره به دو حساب متصل است؛ ابتدا از تنظیمات حساب، اتصال شماره را اصلاح کنید.",
    );
  let person = people[0];
  if (input.unitId) {
    const assigned = await tx.query.membership.findFirst({
      where: and(
        eq(membership.buildingId, actor.buildingId),
        eq(membership.unitId, input.unitId),
        person ? ne(membership.userId, person.id) : undefined,
      ),
    });
    if (assigned)
      throw new Error(
        "برای این واحد قبلاً حساب ساخته شده است؛ حساب همان واحد را ویرایش کنید.",
      );
  }
  if (person) {
    const memberships = await tx.query.membership.findMany({
      where: eq(membership.userId, person.id),
    });
    if (
      memberships.some((m) => m.buildingId !== actor.buildingId) ||
      memberships.length > 1
    )
      throw new Error("این شماره به حساب ساختمان دیگری متصل است.");
    const existing = memberships[0];
    if (existing) {
      if (input.role === "resident")
        throw new Error(
          "این شماره قبلاً حساب دارد؛ از «نقش و دسترسی» همان حساب استفاده کنید.",
        );
      await changeBuildingRole(
        tx,
        actorId,
        existing.id,
        "manager",
        input.unitId ?? existing.unitId,
        input.passwordHash,
      );
      return person.id;
    }
    const memberId = crypto.randomUUID();
    await tx.insert(membership).values({
      id: memberId,
      userId: person.id,
      buildingId: actor.buildingId,
      unitId: input.unitId,
      role: "resident",
    });
    if (!person.phone)
      await tx
        .update(user)
        .set({ phone, updatedAt: new Date() })
        .where(eq(user.id, person.id));
    await changeBuildingRole(
      tx,
      actorId,
      memberId,
      input.role,
      input.unitId,
      input.passwordHash,
    );
    return person.id;
  }
  if (input.role === "manager" && !input.passwordHash)
    throw new Error("برای مدیر جدید، رمز ورود تعیین کنید.");
  const id = crypto.randomUUID();
  [person] = await tx
    .insert(user)
    .values({
      id,
      name: input.name.trim() || phone,
      email: phoneToAuthEmail(phone),
      phone,
    })
    .returning();
  const memberId = crypto.randomUUID();
  await tx.insert(membership).values({
    id: memberId,
    userId: id,
    buildingId: actor.buildingId,
    unitId: input.unitId,
    role: input.role,
  });
  if (input.passwordHash)
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      password: input.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await logManagementEvent(
    tx,
    actor.buildingId,
    actorId,
    "membership",
    memberId,
    "create",
    person.name,
    undefined,
    { phone, role: input.role, unitId: input.unitId },
  );
  return id;
}

export async function setManagedPassword(
  tx: LedgerTransaction,
  actorId: string,
  memberId: string,
  passwordHash: string,
) {
  const actor = await managerMembership(tx, actorId);
  const target = await tx.query.membership.findFirst({
    where: and(
      eq(membership.id, memberId),
      eq(membership.buildingId, actor.buildingId),
    ),
  });
  if (!target || !passwordHash) throw new Error("حساب یا رمز معتبر نیست.");
  if (target.userId === actorId)
    throw new Error("رمز خودتان را از تنظیمات حساب تغییر دهید.");
  const credential = await tx.query.account.findFirst({
    where: and(
      eq(account.userId, target.userId),
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
      userId: target.userId,
      accountId: target.userId,
      providerId: "credential",
      password: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await tx.delete(session).where(eq(session.userId, target.userId));
  await logManagementEvent(
    tx,
    actor.buildingId,
    actorId,
    "membership",
    target.id,
    "password",
    "تعیین رمز ورود حساب",
    undefined,
    { userId: target.userId },
  );
}

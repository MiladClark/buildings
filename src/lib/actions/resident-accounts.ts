"use server";

import { and, eq, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import {
  claimedDisplayName,
  claimedUnitId,
  joinedPersonName,
  normalizeIranMobile,
  phoneToAuthEmail,
} from "@/lib/auth/phone";
import { ensureFirstManager } from "@/lib/actions/building";
import { db } from "@/lib/db";
import { account, membership, unit, user } from "@/lib/db/schema";
import { requireManager } from "@/lib/session";

const passwordHint = "رمز عبور باید حداقل ۸ کاراکتر باشد.";

function refresh() {
  revalidatePath("/manager", "layout");
  revalidatePath("/resident", "layout");
}

function personName(firstName: string, lastName: string, fallback: string) {
  const joined = joinedPersonName(firstName, lastName);
  if (joined.length > 120)
    throw new Error("نام و نام خانوادگی بیش از حد طولانی است.");
  return joined || fallback;
}

function passwordOf(value: string) {
  if (value.length < 8 || value.length > 200) throw new Error(passwordHint);
  return value;
}

async function unitInBuilding(unitId: string, buildingId: string) {
  const row = await db.query.unit.findFirst({
    where: and(eq(unit.id, unitId), eq(unit.buildingId, buildingId)),
  });
  if (!row || row.deletedAt) throw new Error("واحد پیدا نشد.");
  return row;
}

export async function createResidentShell(form: FormData) {
  const { member } = await requireManager();
  const phone = normalizeIranMobile(String(form.get("phone") ?? ""));
  const name = personName(
    String(form.get("firstName") ?? ""),
    String(form.get("lastName") ?? ""),
    phone,
  );
  const unitId = String(form.get("unitId") ?? "").trim();
  if (unitId) await unitInBuilding(unitId, member.buildingId);
  const email = phoneToAuthEmail(phone);
  const existing = await db.query.user.findFirst({
    where: or(eq(user.phone, phone), eq(user.email, email)),
  });
  if (existing) throw new Error("این شماره تلفن قبلاً ثبت شده است.");

  const userId = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name,
        email,
        phone,
        emailVerified: false,
      });
      await tx.insert(membership).values({
        id: crypto.randomUUID(),
        userId,
        buildingId: member.buildingId,
        unitId: unitId || null,
        role: "resident",
      });
    });
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      throw new Error("این شماره تلفن قبلاً ثبت شده است.");
    throw error;
  }
  refresh();
}

export async function deleteResidentShell(userId: string) {
  const { member } = await requireManager();
  await db.transaction(async (tx) => {
    const row = await tx.query.membership.findFirst({
      where: and(
        eq(membership.userId, userId),
        eq(membership.buildingId, member.buildingId),
        eq(membership.role, "resident"),
      ),
    });
    if (!row) throw new Error("حساب پیدا نشد.");
    const identities = await tx.query.account.findMany({
      where: eq(account.userId, userId),
    });
    if (
      identities.some(
        (identity) => identity.providerId !== "credential" || identity.password,
      )
    )
      throw new Error("این شماره قبلاً ثبت‌نام کرده و حذف نمی‌شود.");
    await tx.delete(user).where(eq(user.id, userId));
  });
  refresh();
}

export async function registerWithPhone(input: {
  phone: string;
  password: string;
  firstName?: string;
  lastName?: string;
  unitId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const phone = normalizeIranMobile(input.phone);
    const password = passwordOf(input.password);
    const typedName = personName(
      input.firstName ?? "",
      input.lastName ?? "",
      "",
    );
    const email = phoneToAuthEmail(phone);
    const requestHeaders = await headers();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(user);
    const isFirst = Number(count) === 0;
    const existing = await db.query.user.findFirst({
      where: or(eq(user.phone, phone), eq(user.email, email)),
    });

    if (existing) {
      const identities = await db.query.account.findMany({
        where: eq(account.userId, existing.id),
      });
      if (
        identities.some(
          (identity) =>
            identity.providerId !== "credential" || identity.password,
        )
      )
        return {
          ok: false,
          message: "این شماره قبلاً ثبت شده است. وارد شوید.",
        };
      const member = await db.query.membership.findFirst({
        where: and(
          eq(membership.userId, existing.id),
          eq(membership.role, "resident"),
        ),
      });
      if (!member)
        return {
          ok: false,
          message: "این شماره به حساب ساختمان وصل نیست. با مدیر هماهنگ کنید.",
        };
      const selectedUnit = String(input.unitId ?? "").trim();
      claimedUnitId(true, selectedUnit, member.unitId);
      await unitInBuilding(selectedUnit, member.buildingId);
      const context = await auth.$context;
      const passwordHash = await context.password.hash(password);
      const now = new Date();
      await db.transaction(async (tx) => {
        const latest = await tx.query.account.findMany({
          where: eq(account.userId, existing.id),
        });
        const latestMember = await tx.query.membership.findFirst({
          where: eq(membership.id, member.id),
        });
        if (
          latest.some(
            (identity) =>
              identity.providerId !== "credential" || identity.password,
          )
        )
          throw new Error("این شماره قبلاً ثبت شده است. وارد شوید.");
        if (latestMember?.unitId !== selectedUnit)
          throw new Error(
            "شماره تلفن و واحد باید با اطلاعات ثبت‌شده توسط مدیر مطابقت داشته باشند.",
          );
        await tx
          .update(user)
          .set({
            name: claimedDisplayName(typedName, existing.name),
            phone,
            updatedAt: now,
          })
          .where(eq(user.id, existing.id));
        await tx.insert(account).values({
          id: crypto.randomUUID(),
          accountId: existing.id,
          providerId: "credential",
          userId: existing.id,
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        });
      });
      try {
        await auth.api.signInEmail({
          body: { email: existing.email, password },
          headers: requestHeaders,
        });
      } catch {
        return {
          ok: false,
          message: "رمز ذخیره شد. از صفحه ورود با همین شماره وارد شوید.",
        };
      }
      refresh();
      return { ok: true };
    }

    const name = typedName || phone;
    await auth.api.signUpEmail({
      body: { email, password, name },
      headers: requestHeaders,
    });
    const created = await db.query.user.findFirst({
      where: eq(user.email, email),
    });
    if (!created) throw new Error("ساخت حساب انجام نشد.");
    if (!created.phone)
      await db.update(user).set({ phone }).where(eq(user.id, created.id));
    if (isFirst) await ensureFirstManager(created.id);
    refresh();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/already|EXISTS/i.test(message))
      return {
        ok: false,
        message: "این شماره قبلاً ثبت شده است. وارد شوید.",
      };
    if (/[\u0600-\u06FF]/.test(message)) return { ok: false, message };
    return {
      ok: false,
      message: "ثبت‌نام انجام نشد. شماره و رمز را بررسی کنید.",
    };
  }
}

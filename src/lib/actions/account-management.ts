"use server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireManager } from "@/lib/session";
import { englishPassword, joinedPersonName } from "@/lib/auth/phone";
import { invalidateBuildingCache } from "@/lib/cache/building";
import {
  addBuildingAccount,
  changeBuildingRole,
  setManagedPassword,
  type BuildingRole,
} from "@/lib/accounts/management";

async function optionalPasswordHash(value: FormDataEntryValue | null) {
  if (!value) return undefined;
  const password = englishPassword(String(value));
  if (password.length < 8 || password.length > 200)
    throw new Error("رمز باید بین ۸ تا ۲۰۰ کاراکتر باشد.");
  return (await auth.$context).password.hash(password);
}
export async function createBuildingAccount(form: FormData) {
  const { session, member } = await requireManager();
  if (
    englishPassword(String(form.get("password") ?? "")) !==
    englishPassword(String(form.get("confirmPassword") ?? ""))
  )
    throw new Error("رمز و تکرار آن یکسان نیستند.");
  const passwordHash = await optionalPasswordHash(form.get("password"));
  await db.transaction((tx) =>
    addBuildingAccount(tx, session.user.id, {
      phone: String(form.get("phone") ?? ""),
      name: joinedPersonName(
        String(form.get("firstName") ?? ""),
        String(form.get("lastName") ?? ""),
      ),
      role: String(form.get("role") ?? "resident") as BuildingRole,
      unitId: String(form.get("unitId") ?? "").trim() || null,
      passwordHash,
    }),
  );
  await invalidateBuildingCache(member.buildingId);
}
export async function saveBuildingRole(memberId: string, form: FormData) {
  const { session, member } = await requireManager();
  if (
    englishPassword(String(form.get("password") ?? "")) !==
    englishPassword(String(form.get("confirmPassword") ?? ""))
  )
    throw new Error("رمز و تکرار آن یکسان نیستند.");
  const passwordHash = await optionalPasswordHash(form.get("password"));
  await db.transaction((tx) =>
    changeBuildingRole(
      tx,
      session.user.id,
      memberId,
      String(form.get("role")) as BuildingRole,
      String(form.get("unitId") ?? "").trim() || null,
      passwordHash,
      String(form.get("phone") ?? ""),
    ),
  );
  await invalidateBuildingCache(member.buildingId);
}
export async function saveManagedPassword(memberId: string, form: FormData) {
  const { session, member } = await requireManager();
  if (
    String(form.get("password") ?? "") !==
    String(form.get("confirmPassword") ?? "")
  )
    throw new Error("رمز و تکرار آن یکسان نیستند.");
  const hash = await optionalPasswordHash(form.get("password"));
  if (!hash) throw new Error("رمز ورود را وارد کنید.");
  await db.transaction((tx) =>
    setManagedPassword(tx, session.user.id, memberId, hash),
  );
  await invalidateBuildingCache(member.buildingId);
}

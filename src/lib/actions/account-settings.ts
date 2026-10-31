"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireManager, requireSession } from "@/lib/session";
import { englishPassword } from "@/lib/auth/phone";
import {
  updateAccountProfile,
  setOwnAccountPassword,
} from "@/lib/accounts/profile";
import { invalidateBuildingCache } from "@/lib/cache/building";
import { setManagerUnit } from "@/lib/accounts/management";

export async function saveOwnUnit(form: FormData) {
  const { session } = await requireManager();
  const buildingId = await db.transaction((tx) =>
    setManagerUnit(
      tx,
      session.user.id,
      String(form.get("unitId") ?? "").trim() || null,
    ),
  );
  await invalidateBuildingCache(buildingId);
}

export async function saveOwnProfile(form: FormData) {
  const login = await requireSession();
  const buildingId = await db.transaction((tx) =>
    updateAccountProfile(tx, login.user.id, login.session.id, {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
    }),
  );
  await invalidateBuildingCache(buildingId);
}
export async function changeOwnPassword(form: FormData) {
  const login = await requireSession();
  const password = englishPassword(String(form.get("password") ?? ""));
  if (password !== englishPassword(String(form.get("confirmPassword") ?? "")))
    throw new Error("رمز و تکرار آن یکسان نیستند.");
  if (password.length < 8 || password.length > 200)
    throw new Error("رمز باید بین ۸ تا ۲۰۰ کاراکتر باشد.");
  const hash = await (await auth.$context).password.hash(password);
  await db.transaction((tx) =>
    setOwnAccountPassword(tx, login.user.id, login.session.id, hash),
  );
  revalidatePath("/manager/account");
  revalidatePath("/resident/account");
}

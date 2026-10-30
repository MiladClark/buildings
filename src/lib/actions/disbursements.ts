"use server";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { invalidateBuildingCache } from "@/lib/cache/building";
import {
  recordDisbursement,
  cancelDisbursement,
  type DisbursementInput,
} from "@/lib/billing/disbursements";

export async function payExpense(
  input: Omit<DisbursementInput, "paidAt"> & { paidAt: string },
) {
  const { member, session } = await requireManager();
  const id = await db.transaction((tx) =>
    recordDisbursement(
      tx,
      member.buildingId,
      { ...input, paidAt: new Date(input.paidAt) },
      session.user.id,
    ),
  );
  await invalidateBuildingCache(member.buildingId);
  return id;
}
export async function voidExpensePayment(id: string, reason: string) {
  const { member, session } = await requireManager();
  await db.transaction((tx) =>
    cancelDisbursement(tx, member.buildingId, id, reason, session.user.id),
  );
  await invalidateBuildingCache(member.buildingId);
}

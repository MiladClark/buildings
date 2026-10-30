"use server";
import { invalidateCurrentBuildingCache } from "@/lib/cache/building";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import type { UtilityBill } from "@/lib/billing/utility-bill";
import {
  saveStandaloneCost,
  includeStandaloneCost,
  detachStandaloneCost,
  setStandaloneCostDeleted,
} from "@/lib/billing/standalone-expenses";

async function refresh() {
  await invalidateCurrentBuildingCache();
}
export async function saveStandaloneExpense(
  input: {
    categoryId: string;
    description: string;
    amountRial: number;
    expenseDate: string;
    maintenanceTicketId?: string | null;
    utilityBill?: UtilityBill | null;
  },
  id?: string,
) {
  const { member, session } = await requireManager();
  const key = await db.transaction((tx) =>
    saveStandaloneCost(
      tx,
      member.buildingId,
      { ...input, expenseDate: new Date(input.expenseDate) },
      session.user.id,
      id,
    ),
  );
  await refresh();
  return key;
}
export async function moveStandaloneExpense(
  id: string,
  periodId: string,
  billingTreatment: "auto" | "separate" = "auto",
) {
  const { member, session } = await requireManager();
  await db.transaction((tx) =>
    includeStandaloneCost(
      tx,
      member.buildingId,
      id,
      periodId,
      session.user.id,
      billingTreatment,
    ),
  );
  await refresh();
}
export async function unbillStandaloneExpense(id: string) {
  const { member, session } = await requireManager();
  await db.transaction((tx) =>
    detachStandaloneCost(tx, member.buildingId, id, session.user.id),
  );
  await refresh();
}
export async function deleteStandaloneExpense(id: string, deleted: boolean) {
  const { member, session } = await requireManager();
  await db.transaction((tx) =>
    setStandaloneCostDeleted(
      tx,
      member.buildingId,
      id,
      deleted,
      session.user.id,
    ),
  );
  await refresh();
}

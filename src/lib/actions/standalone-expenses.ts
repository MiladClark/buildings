"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import {
  saveStandaloneCost,
  includeStandaloneCost,
  detachStandaloneCost,
  setStandaloneCostDeleted,
} from "@/lib/billing/standalone-expenses";

function refresh() {
  revalidatePath("/manager", "layout");
  revalidatePath("/resident", "layout");
}
export async function saveStandaloneExpense(
  input: {
    categoryId: string;
    description: string;
    amountRial: number;
    expenseDate: string;
    maintenanceTicketId?: string | null;
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
  refresh();
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
  refresh();
}
export async function unbillStandaloneExpense(id: string) {
  const { member, session } = await requireManager();
  await db.transaction((tx) =>
    detachStandaloneCost(tx, member.buildingId, id, session.user.id),
  );
  refresh();
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
  refresh();
}

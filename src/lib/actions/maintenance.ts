"use server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { maintenanceTicket } from "@/lib/db/schema";
import { logManagementEvent } from "@/lib/billing/corrections";
import {
  getMembershipForUser,
  requireManager,
  requireSession,
} from "@/lib/session";
export async function listMaintenance() {
  const s = await requireSession();
  const m = await getMembershipForUser(s.user.id);
  if (!m) throw new Error("دسترسی مجاز نیست.");
  return db
    .select()
    .from(maintenanceTicket)
    .where(
      and(
        isNull(maintenanceTicket.deletedAt),
        m.role === "manager"
          ? eq(maintenanceTicket.buildingId, m.buildingId)
          : and(
              eq(maintenanceTicket.buildingId, m.buildingId),
              eq(maintenanceTicket.createdBy, s.user.id),
            ),
      ),
    )
    .orderBy(desc(maintenanceTicket.createdAt));
}
export async function createMaintenance(f: FormData) {
  const s = await requireSession();
  const m = await getMembershipForUser(s.user.id);
  if (!m) throw new Error("دسترسی مجاز نیست.");
  const title = String(f.get("title") || "").trim();
  const description = String(f.get("description") || "").trim();
  if (!title || title.length > 150 || description.length > 3000)
    throw new Error("عنوان و شرح درخواست را به‌درستی وارد کنید.");
  const schedule = f.get("scheduledAt")
    ? new Date(String(f.get("scheduledAt")))
    : null;
  if (
    schedule &&
    (!Number.isFinite(schedule.getTime()) || m.role !== "manager")
  )
    throw new Error("تاریخ رسیدگی معتبر نیست.");
  await db.insert(maintenanceTicket).values({
    id: crypto.randomUUID(),
    buildingId: m.buildingId,
    unitId: m.unitId,
    createdBy: s.user.id,
    title,
    description,
    priority: f.get("priority") === "urgent" ? "urgent" : "normal",
    scheduledAt: schedule,
  });
  revalidatePath("/manager", "layout");
  revalidatePath("/resident", "layout");
}
export async function updateMaintenance(
  id: string,
  status: "open" | "in_progress" | "resolved",
) {
  const { member, session } = await requireManager();
  if (!["open", "in_progress", "resolved"].includes(status))
    throw new Error("وضعیت معتبر نیست.");
  await db.transaction(async (tx) => {
    const previous = await tx.query.maintenanceTicket.findFirst({
      where: and(
        eq(maintenanceTicket.id, id),
        eq(maintenanceTicket.buildingId, member.buildingId),
        isNull(maintenanceTicket.deletedAt),
      ),
    });
    if (!previous) throw new Error("درخواست پیدا نشد.");
    await tx
      .update(maintenanceTicket)
      .set({ status })
      .where(eq(maintenanceTicket.id, id));
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "maintenance",
      id,
      "status",
      previous.title,
      previous,
      { status },
    );
  });
  revalidatePath("/manager", "layout");
  revalidatePath("/resident", "layout");
}

export async function editMaintenance(id: string, f: FormData) {
  const { member, session } = await requireManager();
  const title = String(f.get("title") || "").trim(),
    description = String(f.get("description") || "").trim();
  const priority = String(f.get("priority")),
    status = String(f.get("status"));
  const scheduledAt = f.get("scheduledAt")
    ? new Date(String(f.get("scheduledAt")))
    : null;
  if (
    !title ||
    title.length > 150 ||
    description.length > 3000 ||
    !["normal", "urgent"].includes(priority) ||
    !["open", "in_progress", "resolved"].includes(status) ||
    (scheduledAt && !Number.isFinite(scheduledAt.getTime()))
  )
    throw new Error("اطلاعات درخواست معتبر نیست.");
  const values = {
    title,
    description,
    priority: priority as "normal" | "urgent",
    status: status as "open" | "in_progress" | "resolved",
    scheduledAt,
  };
  await db.transaction(async (tx) => {
    const previous = await tx.query.maintenanceTicket.findFirst({
      where: and(
        eq(maintenanceTicket.id, id),
        eq(maintenanceTicket.buildingId, member.buildingId),
        isNull(maintenanceTicket.deletedAt),
      ),
    });
    if (!previous) throw new Error("درخواست پیدا نشد.");
    await tx
      .update(maintenanceTicket)
      .set(values)
      .where(eq(maintenanceTicket.id, id));
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "maintenance",
      id,
      "edit",
      title,
      previous,
      values,
    );
  });
  revalidatePath("/manager", "layout");
  revalidatePath("/resident", "layout");
}

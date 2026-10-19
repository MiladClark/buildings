import { and, eq } from "drizzle-orm";
import { maintenanceTicket } from "@/lib/db/schema";
import type { LedgerTransaction } from "./settlement-store";

export async function validateMaintenanceLink(
  tx: LedgerTransaction,
  buildingId: string,
  ticketId?: string | null,
  previousId?: string | null,
) {
  if (!ticketId) return;
  const ticket = await tx.query.maintenanceTicket.findFirst({
    where: and(
      eq(maintenanceTicket.id, ticketId),
      eq(maintenanceTicket.buildingId, buildingId),
    ),
  });
  if (!ticket || (ticket.deletedAt && ticket.id !== previousId))
    throw new Error("درخواست مرتبط پیدا نشد یا حذف شده است.");
}

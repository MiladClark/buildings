import { and, eq } from "drizzle-orm";
import { appNotification, membership } from "@/lib/db/schema";
import type { LedgerTransaction } from "./settlement-store";

/** In private manager mode there are no recipients. If resident accounts are
 * connected later, their notices commit atomically with the ledger change. */
export async function notifyUnitAccounts(
  tx: LedgerTransaction,
  buildingId: string,
  unitIds: string[],
  title: string,
  body: string,
) {
  const members = await tx
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.buildingId, buildingId),
        eq(membership.role, "resident"),
      ),
    );
  const users = new Set(
    members
      .filter((m) => m.unitId && unitIds.includes(m.unitId))
      .map((m) => m.userId),
  );
  for (const userId of users)
    await tx
      .insert(appNotification)
      .values({ id: crypto.randomUUID(), userId, title, body });
}

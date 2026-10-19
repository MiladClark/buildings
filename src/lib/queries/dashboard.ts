import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  billingPeriod,
  building,
  membership,
  unitInvoice,
  user,
} from "@/lib/db/schema";
export async function getBuildingForUser(userId: string) {
  const member = await db.query.membership.findFirst({
    where: eq(membership.userId, userId),
  });
  if (!member) return null;
  const b = await db.query.building.findFirst({
    where: eq(building.id, member.buildingId),
  });
  return b ? { building: b, membership: member } : null;
}
export async function getResidentInvoices(unitId: string) {
  return db
    .select({ invoice: unitInvoice, period: billingPeriod })
    .from(unitInvoice)
    .innerJoin(billingPeriod, eq(unitInvoice.periodId, billingPeriod.id))
    .where(and(eq(unitInvoice.unitId, unitId), isNull(billingPeriod.deletedAt)))
    .orderBy(desc(billingPeriod.startDate), desc(billingPeriod.createdAt));
}
export async function listPeriods(buildingId: string) {
  return db
    .select()
    .from(billingPeriod)
    .where(
      and(
        eq(billingPeriod.buildingId, buildingId),
        isNull(billingPeriod.deletedAt),
      ),
    )
    .orderBy(desc(billingPeriod.startDate));
}
export async function countUsers() {
  const result = await db.select({ count: sql<number>`count(*)` }).from(user);
  return Number(result[0]?.count ?? 0);
}

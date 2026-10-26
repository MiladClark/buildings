import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { unit } from "@/lib/db/schema";

export async function registrationUnits() {
  const currentBuilding = await db.query.building.findFirst();
  return currentBuilding
    ? db
        .select({ id: unit.id, label: unit.label })
        .from(unit)
        .where(
          and(eq(unit.buildingId, currentBuilding.id), isNull(unit.deletedAt)),
        )
        .orderBy(asc(unit.sortOrder), asc(unit.label))
    : [];
}

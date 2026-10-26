import { and, eq, isNull } from "drizzle-orm";
import { registrationUnitNumber } from "@/lib/auth/phone";
import { db } from "@/lib/db";
import { unit } from "@/lib/db/schema";

export function registrationUnitChoices<T extends { label: string }>(
  units: T[],
) {
  return units
    .filter((item) => registrationUnitNumber(item.label) !== null)
    .sort(
      (a, b) =>
        registrationUnitNumber(a.label)! - registrationUnitNumber(b.label)!,
    );
}

export async function registrationUnits() {
  const currentBuilding = await db.query.building.findFirst();
  if (!currentBuilding) return [];
  const rows = await db
    .select({ id: unit.id, label: unit.label })
    .from(unit)
    .where(
      and(eq(unit.buildingId, currentBuilding.id), isNull(unit.deletedAt)),
    );
  return registrationUnitChoices(rows);
}

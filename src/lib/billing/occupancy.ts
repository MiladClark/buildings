import type { UnitSnapshot } from "./types";

type Occupancy = Pick<
  UnitSnapshot,
  "status" | "occupantCount" | "temporarilyAbsent"
>;

/** Keep the usual household size on file, but bill only people currently present. */
export function effectiveOccupants(unit: Occupancy): number {
  return unit.temporarilyAbsent || unit.status === "empty"
    ? 0
    : Math.max(0, unit.occupantCount);
}

/** Temporary absence never exempts a unit from common or standing charges. */
export function paysUnitCharges(
  unit: Pick<Occupancy, "status" | "temporarilyAbsent">,
  includeEmpty: boolean,
): boolean {
  return !!unit.temporarilyAbsent || unit.status !== "empty" || includeEmpty;
}

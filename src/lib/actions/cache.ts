"use server";

import { refresh } from "next/cache";

import {
  expireBuildingCache,
  invalidateBuildingCache,
} from "@/lib/cache/building";
import { requireManager } from "@/lib/session";

export async function reloadBuildingCache() {
  const { member } = await requireManager();
  await invalidateBuildingCache(member.buildingId);
  refresh();
}

export async function clearBuildingCache() {
  const { member } = await requireManager();
  await expireBuildingCache(member.buildingId);
  refresh();
}

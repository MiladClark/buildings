import { revalidatePath, revalidateTag, updateTag } from "next/cache";

import { getMembershipForUser, getSession } from "@/lib/session";

export function buildingCacheTag(buildingId: string) {
  return `building:${buildingId}`;
}

export async function invalidateBuildingCache(buildingId: string) {
  revalidatePath("/manager", "layout");
  revalidatePath("/resident", "layout");
  updateTag(buildingCacheTag(buildingId));
}

export async function expireBuildingCache(buildingId: string) {
  revalidatePath("/manager", "layout");
  revalidatePath("/resident", "layout");
  revalidateTag(buildingCacheTag(buildingId), { expire: 0 });
  updateTag(buildingCacheTag(buildingId));
}

export async function invalidateCurrentBuildingCache() {
  try {
    const session = await getSession();
    if (!session) return;
    const member = await getMembershipForUser(session.user.id);
    if (!member) return;
    await invalidateBuildingCache(member.buildingId);
  } catch (error) {
    console.error("Building cache invalidation failed", error);
  }
}

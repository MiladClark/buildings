import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { membership } from "@/lib/db/schema";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function getMembershipForUser(userId: string) {
  const rows = await db
    .select()
    .from(membership)
    .where(eq(membership.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireManager() {
  const session = await requireSession();
  const member = await getMembershipForUser(session.user.id);
  if (!member || member.role !== "manager") {
    throw new Error("FORBIDDEN");
  }
  return { session, member };
}

export async function requireResident() {
  const session = await requireSession();
  const member = await getMembershipForUser(session.user.id);
  if (!member || member.role !== "resident") {
    throw new Error("FORBIDDEN");
  }
  return { session, member };
}

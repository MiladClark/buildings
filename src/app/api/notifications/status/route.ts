import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { unreadNotificationCount } from "@/lib/notifications/queries";
export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(
    { unread: await unreadNotificationCount(session.user.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

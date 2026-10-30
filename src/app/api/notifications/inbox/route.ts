import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getNotificationPreview } from "@/lib/notifications/inbox";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await getNotificationPreview(session.user.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { markNotificationRead } from "@/lib/actions/notifications";
import { isSameOriginRequest } from "@/lib/request-security";
export async function POST(request: Request) {
  if (
    !isSameOriginRequest(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!(await getSession()))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const input = await request.json().catch(() => null);
  if (typeof input?.id !== "string" || !input.id || input.id.length > 100)
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  await markNotificationRead(input.id);
  return NextResponse.json({ ok: true });
}

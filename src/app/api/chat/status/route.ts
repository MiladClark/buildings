import { getChatInboxStatus, requireChatContext } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const context = await requireChatContext();
    return Response.json(await getChatInboxStatus(context));
  } catch (error) {
    const message = error instanceof Error ? error.message : "FORBIDDEN";
    const status = message === "UNAUTHORIZED" ? 401 : 403;
    return Response.json({ error: message }, { status });
  }
}

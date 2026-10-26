import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { chatMessage } from "@/lib/db/schema";
import { requireChatContext } from "@/lib/chat";
import { readChatImage } from "@/lib/chat-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const chatContext = await requireChatContext();
    const { id } = await context.params;
    const message = await db.query.chatMessage.findFirst({
      where: and(
        eq(chatMessage.id, id),
        eq(chatMessage.buildingId, chatContext.member.buildingId),
        isNull(chatMessage.deletedAt),
      ),
    });
    if (!message?.imageKey) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const image = await readChatImage(message.imageKey);
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": message.imageMimeType ?? "image/webp",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 404;
    return Response.json({ error: "NOT_FOUND" }, { status });
  }
}

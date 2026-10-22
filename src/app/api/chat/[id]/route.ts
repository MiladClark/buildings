import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { chatMessage } from "@/lib/db/schema";
import {
  isValidChatBody,
  normalizeChatBody,
  requireChatContext,
} from "@/lib/chat";
import { removeChatImage } from "@/lib/chat-images";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";

async function findMessage(id: string, buildingId: string) {
  return db.query.chatMessage.findFirst({
    where: and(
      eq(chatMessage.id, id),
      eq(chatMessage.buildingId, buildingId),
      isNull(chatMessage.deletedAt),
    ),
  });
}

function errorResponse(error: unknown, fallback = "خطایی رخ داد.") {
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message === "UNAUTHORIZED"
      ? 401
      : message === "FORBIDDEN"
        ? 403
        : message === "NOT_FOUND"
          ? 404
          : 400;
  return Response.json({ error: message || fallback }, { status });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json({ error: "درخواست معتبر نیست." }, { status: 403 });
    }
    const chatContext = await requireChatContext();
    const { id } = await context.params;
    const message = await findMessage(id, chatContext.member.buildingId);
    if (!message) throw new Error("NOT_FOUND");
    if (message.userId !== chatContext.session.user.id) {
      throw new Error("FORBIDDEN");
    }

    const payload = (await request.json()) as { body?: unknown };
    const body = normalizeChatBody(payload.body);
    if (!isValidChatBody(body)) {
      return Response.json(
        { error: "متن پیام نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد." },
        { status: 400 },
      );
    }
    if (!body && !message.imageKey) {
      return Response.json(
        { error: "پیام بدون متن یا تصویر نمی‌تواند ذخیره شود." },
        { status: 400 },
      );
    }

    await db
      .update(chatMessage)
      .set({ body, editedAt: new Date() })
      .where(eq(chatMessage.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "پیام ویرایش نشد.");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json({ error: "درخواست معتبر نیست." }, { status: 403 });
    }
    const chatContext = await requireChatContext();
    const { id } = await context.params;
    const message = await findMessage(id, chatContext.member.buildingId);
    if (!message) throw new Error("NOT_FOUND");
    const canDelete =
      message.userId === chatContext.session.user.id ||
      chatContext.member.role === "manager";
    if (!canDelete) throw new Error("FORBIDDEN");

    await db
      .update(chatMessage)
      .set({ deletedAt: new Date() })
      .where(eq(chatMessage.id, id));
    await removeChatImage(message.imageKey);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "پیام حذف نشد.");
  }
}

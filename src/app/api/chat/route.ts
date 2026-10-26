import { db } from "@/lib/db";
import { chatMessage } from "@/lib/db/schema";
import {
  isValidChatBody,
  listChatMembers,
  listChatMessages,
  normalizeChatBody,
  requireChatContext,
} from "@/lib/chat";
import { removeChatImage, saveChatImage } from "@/lib/chat-images";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorResponse(error: unknown, fallback = "خطایی رخ داد.") {
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 400;
  return Response.json({ error: message || fallback }, { status });
}

export async function GET() {
  try {
    const context = await requireChatContext();
    const [messages, members] = await Promise.all([
      listChatMessages(context),
      listChatMembers(context),
    ]);
    return Response.json({ messages, members });
  } catch (error) {
    return errorResponse(error, "گفتگو قابل دریافت نیست.");
  }
}

export async function POST(request: Request) {
  let imageKey: string | null = null;
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json({ error: "درخواست معتبر نیست." }, { status: 403 });
    }
    const context = await requireChatContext();
    const form = await request.formData();
    const body = normalizeChatBody(form.get("body"));
    const image = form.get("image");
    const hasImage = image instanceof File && image.size > 0;

    if (!isValidChatBody(body)) {
      return Response.json(
        { error: "متن پیام نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد." },
        { status: 400 },
      );
    }
    if (!body && !hasImage) {
      return Response.json(
        { error: "متن یا تصویر پیام را وارد کنید." },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const storedImage = hasImage
      ? await saveChatImage(image, context.member.buildingId, id)
      : null;
    imageKey = storedImage?.key ?? null;

    await db.insert(chatMessage).values({
      id,
      buildingId: context.member.buildingId,
      userId: context.session.user.id,
      body,
      imageKey,
      imageMimeType: storedImage?.mimeType,
      imageName: storedImage?.name,
    });

    const messages = await listChatMessages(context);
    return Response.json(
      { message: messages.find((message) => message.id === id) },
      { status: 201 },
    );
  } catch (error) {
    await removeChatImage(imageKey);
    return errorResponse(error, "پیام ارسال نشد.");
  }
}

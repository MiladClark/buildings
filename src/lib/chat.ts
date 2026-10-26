import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { chatMessage, membership, unit, user } from "@/lib/db/schema";
import { getMembershipForUser, requireSession } from "@/lib/session";

export const CHAT_BODY_LIMIT = 2_000;
export const CHAT_IMAGE_LIMIT = 8 * 1024 * 1024;
export const CHAT_PAGE_SIZE = 100;

export type ChatContext = {
  session: Awaited<ReturnType<typeof requireSession>>;
  member: NonNullable<Awaited<ReturnType<typeof getMembershipForUser>>>;
};

export type ChatMemberView = {
  id: string;
  name: string;
  unit: string | null;
  role: "manager" | "resident" | "accountant";
};

export type ChatInboxStatus = {
  buildingId: string;
  latestId: string | null;
  fromSelf: boolean;
};

export type ChatMessageView = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  authorUnit: string | null;
  authorRole: "manager" | "resident" | "accountant";
  imageName: string | null;
  imageUrl: string | null;
  createdAt: string;
  editedAt: string | null;
  isOwn: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export function normalizeChatBody(value: unknown) {
  return String(value ?? "").trim();
}

export function isValidChatBody(body: string) {
  return body.length <= CHAT_BODY_LIMIT;
}

export async function requireChatContext(): Promise<ChatContext> {
  const session = await requireSession();
  const member = await getMembershipForUser(session.user.id);
  if (!member) throw new Error("FORBIDDEN");
  return { session, member };
}

export async function listChatMessages(
  context: ChatContext,
): Promise<ChatMessageView[]> {
  const rows = await db
    .select({
      id: chatMessage.id,
      body: chatMessage.body,
      authorId: chatMessage.userId,
      authorName: user.name,
      authorUnit: unit.label,
      authorRole: membership.role,
      imageName: chatMessage.imageName,
      imageKey: chatMessage.imageKey,
      createdAt: chatMessage.createdAt,
      editedAt: chatMessage.editedAt,
    })
    .from(chatMessage)
    .innerJoin(user, eq(chatMessage.userId, user.id))
    .innerJoin(
      membership,
      and(
        eq(membership.userId, chatMessage.userId),
        eq(membership.buildingId, chatMessage.buildingId),
      ),
    )
    .leftJoin(unit, eq(membership.unitId, unit.id))
    .where(
      and(
        eq(chatMessage.buildingId, context.member.buildingId),
        isNull(chatMessage.deletedAt),
      ),
    )
    .orderBy(desc(chatMessage.createdAt))
    .limit(CHAT_PAGE_SIZE);

  return rows.reverse().map((row) => {
    const isOwn = row.authorId === context.session.user.id;
    return {
      id: row.id,
      body: row.body,
      authorId: row.authorId,
      authorName: row.authorName,
      authorUnit: row.authorUnit,
      authorRole: row.authorRole,
      imageName: row.imageName,
      imageUrl: row.imageKey ? `/api/chat/image/${row.id}` : null,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      isOwn,
      canEdit: isOwn,
      canDelete: isOwn || context.member.role === "manager",
    };
  });
}

export async function listChatMembers(
  context: ChatContext,
): Promise<ChatMemberView[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      unit: unit.label,
      role: membership.role,
    })
    .from(membership)
    .innerJoin(user, eq(membership.userId, user.id))
    .leftJoin(unit, eq(membership.unitId, unit.id))
    .where(eq(membership.buildingId, context.member.buildingId))
    .orderBy(asc(user.name));

  const unique = new Map<string, ChatMemberView>();
  for (const row of rows) {
    if (!unique.has(row.id)) unique.set(row.id, row);
  }
  return [...unique.values()];
}

export async function getChatInboxStatus(
  context: ChatContext,
): Promise<ChatInboxStatus> {
  const [latest] = await db
    .select({
      id: chatMessage.id,
      userId: chatMessage.userId,
    })
    .from(chatMessage)
    .where(
      and(
        eq(chatMessage.buildingId, context.member.buildingId),
        isNull(chatMessage.deletedAt),
      ),
    )
    .orderBy(desc(chatMessage.createdAt))
    .limit(1);

  return {
    buildingId: context.member.buildingId,
    latestId: latest?.id ?? null,
    fromSelf: latest ? latest.userId === context.session.user.id : false,
  };
}

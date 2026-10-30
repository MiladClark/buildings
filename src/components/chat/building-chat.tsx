/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ArrowDown,
  ArrowRight,
  Check,
  MessageCircle,
  Image as ImageIcon,
  Send,
  Pencil,
  Smile,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ChatMemberView, ChatMessageView } from "@/lib/chat";
import { markChatSeen } from "@/lib/chat-seen";

const EMOJIS = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😘",
  "😎",
  "🤔",
  "😅",
  "😢",
  "😭",
  "😡",
  "🤯",
  "😴",
  "🤝",
  "👍",
  "👎",
  "👏",
  "🙏",
  "💪",
  "👌",
  "❤️",
  "🔥",
  "✨",
  "🎉",
  "✅",
  "❌",
  "⚠️",
  "📌",
  "🏠",
  "🔑",
  "💡",
  "📅",
  "💰",
  "🧹",
  "🔧",
  "📞",
];

const timeFormatter = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran",
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const roleLabel: Record<ChatMemberView["role"], string> = {
  manager: "مدیر",
  resident: "ساکن",
  accountant: "حسابدار",
};

function messageDay(value: string) {
  try {
    const d = new Date(value);
    const now = new Date();
    const dStr = d.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" });
    const nowStr = now.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" });
    if (dStr === nowStr) return "امروز";

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yStr = yesterday.toLocaleDateString("fa-IR", {
      timeZone: "Asia/Tehran",
    });
    if (dStr === yStr) return "دیروز";

    return dayFormatter.format(d);
  } catch {
    return "";
  }
}

function mentionAt(value: string, cursor: number) {
  const upto = value.slice(0, cursor);
  const match = upto.match(/(^|[\s\n])@([^\s@]*)$/);
  if (!match) return null;
  const query = match[2] ?? "";
  return { query, start: upto.length - query.length - 1 };
}

function isMentionBoundary(char: string | undefined) {
  if (!char) return true;
  return /[\s.,!?;:،؛!?»«()[\]{}]/.test(char);
}

function highlightMentions(
  body: string,
  members: ChatMemberView[],
  own: boolean,
) {
  const names = [...members].sort((a, b) => b.name.length - a.name.length);
  const parts: React.ReactNode[] = [];
  let index = 0;

  while (index < body.length) {
    if (body[index] === "@") {
      const rest = body.slice(index + 1);
      const hit = names.find(
        (member) =>
          rest.startsWith(member.name) &&
          isMentionBoundary(rest[member.name.length]),
      );
      if (hit) {
        parts.push(
          <span
            key={index}
            className={
              own
                ? "font-semibold underline decoration-primary-foreground/50 underline-offset-2"
                : "font-semibold text-primary"
            }
          >
            @{hit.name}
          </span>,
        );
        index += hit.name.length + 1;
        continue;
      }
    }

    const next = body.indexOf("@", index + 1);
    const end = next === -1 ? body.length : next;
    parts.push(body.slice(index, end));
    index = end === index ? index + 1 : end;
  }

  return parts;
}

async function responseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error && !/^[A-Z_]+$/.test(payload.error)
    ? payload.error
    : fallback;
}

export function BuildingChat({
  buildingId,
  buildingName,
  initialMessages,
  initialMembers = [],
}: {
  buildingId: string;
  buildingName: string;
  initialMessages?: ChatMessageView[];
  initialMembers?: ChatMemberView[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageView[]>(
    initialMessages ?? [],
  );
  const [members, setMembers] = useState<ChatMemberView[]>(initialMembers);
  const [body, setBody] = useState("");
  const [caret, setCaret] = useState(0);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialMessages);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imagePreviewRef = useRef<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const initialized = useRef(Boolean(initialMessages?.length));

  const mention = useMemo(() => mentionAt(body, caret), [body, caret]);
  const mentionKey = mention ? `${mention.start}:${mention.query}` : "";
  const [mentionSession, setMentionSession] = useState(mentionKey);
  if (mentionSession !== mentionKey) {
    setMentionSession(mentionKey);
    setMentionIndex(0);
    setMentionDismissed(false);
  }
  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.trim().toLowerCase();
    return members
      .filter((member) => {
        if (!query) return true;
        return (
          member.name.toLowerCase().includes(query) ||
          (member.unit ?? "").toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [members, mention]);

  const loadMessages = useCallback(async (quiet = false) => {
    try {
      const response = await fetch("/api/chat", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("LOAD_FAILED");
      const payload = (await response.json()) as {
        messages: ChatMessageView[];
        members?: ChatMemberView[];
      };

      setMessages((prev) => {
        if (
          prev.length === payload.messages.length &&
          prev.every(
            (m, i) =>
              m.id === payload.messages[i]?.id &&
              m.editedAt === payload.messages[i]?.editedAt,
          )
        ) {
          return prev;
        }
        return payload.messages;
      });
      if (payload.members) setMembers(payload.members);
    } catch {
      if (!quiet) toast.error("گفتگو دریافت نشد. لطفاً اتصال را بررسی کنید.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => void loadMessages(true), 5_000);
    return () => window.clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    const latest = messages.at(-1);
    if (latest) markChatSeen(buildingId, latest.id);
  }, [buildingId, messages]);

  useEffect(() => {
    return () => {
      if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    };
  }, []);

  useEffect(() => {
    if ((!initialized.current || followLatest.current) && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
      initialized.current = true;
    }
  }, [messages]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const query = window.matchMedia("(max-width: 1023px)");
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
    };

    const clearFrame = () => {
      section.style.top = "";
      section.style.right = "";
      section.style.bottom = "";
      section.style.left = "";
      section.style.height = "";
      const form = section.querySelector("form");
      if (form instanceof HTMLElement) form.style.paddingBottom = "";
    };

    const apply = () => {
      if (!query.matches) {
        clearFrame();
        html.style.overflow = previous.htmlOverflow;
        body.style.overflow = previous.bodyOverflow;
        return;
      }

      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const keyboard = Math.max(0, window.innerHeight - height - top);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      section.style.top = `${top}px`;
      section.style.right = "0px";
      section.style.bottom = "auto";
      section.style.left = "0px";
      section.style.height = `${height}px`;
      const form = section.querySelector("form");
      if (form instanceof HTMLElement) {
        form.style.paddingBottom = keyboard > 120 ? "0.5rem" : "";
      }
      if (followLatest.current && listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    };

    apply();
    query.addEventListener("change", apply);
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    return () => {
      query.removeEventListener("change", apply);
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
      clearFrame();
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
    };
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!composerRef.current?.contains(event.target as Node)) {
        setEmojiOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function scrollToBottom() {
    if (!listRef.current) return;
    listRef.current.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
    followLatest.current = true;
    setShowScrollBottom(false);
  }

  function handleScroll(element: HTMLDivElement) {
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    followLatest.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);
  }

  function selectImage(selected: File | null) {
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    const preview = selected ? URL.createObjectURL(selected) : null;
    imagePreviewRef.current = preview;
    setImage(selected);
    setImagePreview(preview);
  }

  function resizeComposer() {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 128)}px`;
  }

  function syncCaret(field: HTMLTextAreaElement) {
    setCaret(field.selectionStart ?? 0);
  }

  function insertAtCursor(token: string) {
    const field = textareaRef.current;
    const cursor = field?.selectionStart ?? caret;
    const next = body.slice(0, cursor) + token + body.slice(cursor);
    setBody(next);
    const pos = cursor + token.length;
    setCaret(pos);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(pos, pos);
      resizeComposer();
    });
  }

  function insertMention(member: ChatMemberView) {
    const active = mentionAt(body, caret);
    if (!active) return;
    const token = `@${member.name} `;
    const next = body.slice(0, active.start) + token + body.slice(caret);
    const pos = active.start + token.length;
    setBody(next);
    setCaret(pos);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
      resizeComposer();
    });
  }

  async function sendMessage(event?: React.FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    const cleanBody = body.trim();
    if ((!cleanBody && !image) || sending) return;

    setSending(true);
    try {
      const form = new FormData();
      form.set("body", cleanBody);
      if (image) form.set("image", image);

      const response = await fetch("/api/chat", { method: "POST", body: form });
      if (!response.ok) {
        throw new Error(await responseError(response, "پیام ارسال نشد."));
      }

      const payload = (await response.json()) as { message?: ChatMessageView };

      setBody("");
      setCaret(0);
      setEmojiOpen(false);
      selectImage(null);
      if (fileRef.current) fileRef.current.value = "";
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      if (payload?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message!.id)) return prev;
          return [...prev, payload.message!];
        });
      }

      followLatest.current = true;
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }

      void loadMessages(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "پیام ارسال نشد.");
    } finally {
      setSending(false);
    }
  }

  function beginEdit(message: ChatMessageView) {
    setEditingId(message.id);
    setEditBody(message.body);
  }

  async function saveEdit(message: ChatMessageView) {
    const nextBody = editBody.trim();
    if (!nextBody && !message.imageUrl) {
      toast.error("پیام بدون متن یا تصویر نمی‌تواند ذخیره شود.");
      return;
    }
    setSavingId(message.id);
    try {
      const response = await fetch(`/api/chat/${message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: nextBody }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "پیام ویرایش نشد."));
      }
      setEditingId(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, body: nextBody, editedAt: new Date().toISOString() }
            : m,
        ),
      );
      void loadMessages(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "پیام ویرایش نشد.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteMessage(message: ChatMessageView) {
    if (!window.confirm("این پیام برای همه اعضای ساختمان حذف شود؟")) return;
    setDeletingId(message.id);
    try {
      const response = await fetch(`/api/chat/${message.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "پیام حذف نشد."));
      }
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      void loadMessages(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "پیام حذف نشد.");
    } finally {
      setDeletingId(null);
    }
  }

  function onComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && !mentionDismissed && mentionMatches.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((current) => (current + 1) % mentionMatches.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex(
          (current) =>
            (current - 1 + mentionMatches.length) % mentionMatches.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const selected = mentionMatches[mentionIndex] ?? mentionMatches[0];
        if (selected) insertMention(selected);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionDismissed(true);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if ((body.trim() || image) && !sending) void sendMessage();
    }
  }

  return (
    <section
      ref={sectionRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background lg:static lg:z-auto lg:h-[calc(100dvh-12.5rem)] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:shadow-xs"
    >
      <header className="z-10 flex shrink-0 items-center gap-2 border-b border-border bg-card px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:px-4 lg:py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex size-11 items-center justify-center rounded-full text-foreground lg:hidden"
          aria-label="بستن گفتگو"
        >
          <ArrowRight size={22} />
        </button>
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageCircle size={22} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-foreground">
            گفتگوی {buildingName}
          </h2>
          <p className="truncate text-[11px] text-muted-foreground">
            {members.length.toLocaleString("fa-IR")} عضو
          </p>
        </div>
      </header>

      <div
        ref={listRef}
        onScroll={(event) => handleScroll(event.currentTarget)}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/30 px-3 py-4 sm:px-5"
        aria-live="polite"
        aria-label="پیام‌های گروه ساختمان"
      >
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle className="animate-spin text-primary" size={24} />
            <span>در حال بارگذاری گفتگو...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle size={30} strokeWidth={1.75} />
            </span>
            <p className="text-sm font-semibold text-foreground">
              هنوز پیامی ثبت نشده است
            </p>
            <p className="mt-1.5 max-w-xs text-xs leading-6 text-muted-foreground">
              اولین پیام را برای اعضای ساختمان بنویسید.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const currentDayLabel = messageDay(message.createdAt);
            const prevDayLabel = previous
              ? messageDay(previous.createdAt)
              : null;
            const showDay = !previous || currentDayLabel !== prevDayLabel;
            const groupedWithPrevious =
              !showDay && previous?.authorId === message.authorId;
            const groupedWithNext =
              Boolean(next) &&
              messageDay(next!.createdAt) === currentDayLabel &&
              next!.authorId === message.authorId;

            return (
              <div key={message.id}>
                {showDay && currentDayLabel && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-2xs">
                      {currentDayLabel}
                    </span>
                  </div>
                )}

                <article
                  className={`flex items-end gap-2 ${
                    message.isOwn ? "flex-row-reverse" : "flex-row"
                  } ${groupedWithPrevious ? "mt-0.5" : "mt-3"}`}
                >
                  {!message.isOwn && (
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold text-foreground ring-1 ring-border ${
                        groupedWithNext ? "invisible" : ""
                      }`}
                    >
                      {message.authorName.slice(0, 1)}
                    </span>
                  )}

                  <div
                    className={`group flex max-w-[82%] flex-col sm:max-w-[68%] ${
                      message.isOwn ? "items-start" : "items-start"
                    }`}
                  >
                    {!message.isOwn && !groupedWithPrevious && (
                      <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px]">
                        <span className="font-semibold text-primary">
                          {message.authorName}
                        </span>
                        {message.authorUnit && (
                          <span className="text-[10px] text-muted-foreground">
                            واحد {message.authorUnit}
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      className={`relative w-fit max-w-full px-3 py-1.5 shadow-2xs ${
                        message.isOwn
                          ? "rounded-2xl rounded-es-md bg-primary text-primary-foreground"
                          : "rounded-2xl rounded-ee-md bg-card text-foreground"
                      }`}
                    >
                      {message.imageUrl && (
                        <a
                          href={message.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-1.5 mt-0.5 block overflow-hidden rounded-xl"
                          title="نمایش تصویر در ابعاد کامل"
                        >
                          <img
                            src={message.imageUrl}
                            alt={message.imageName || "تصویر ضمیمه"}
                            className="max-h-72 w-full object-contain"
                            onLoad={() => {
                              if (followLatest.current && listRef.current) {
                                listRef.current.scrollTop =
                                  listRef.current.scrollHeight;
                              }
                            }}
                          />
                        </a>
                      )}

                      {editingId === message.id ? (
                        <div className="min-w-[220px] space-y-2 py-1 sm:min-w-[280px]">
                          <label className="form-field">
                            <span>ویرایش متن پیام</span>
                            <textarea
                              value={editBody}
                              onChange={(event) =>
                                setEditBody(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault();
                                  void saveEdit(message);
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  setEditingId(null);
                                }
                              }}
                              autoFocus
                              rows={3}
                              className="form-control form-textarea w-full"
                              placeholder=" "
                              maxLength={2_000}
                              aria-label="ویرایش متن پیام"
                            />
                          </label>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => setEditingId(null)}
                            >
                              انصراف
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 px-2.5 text-xs"
                              onClick={() => void saveEdit(message)}
                              disabled={savingId === message.id}
                            >
                              {savingId === message.id ? (
                                <LoaderCircle
                                  className="animate-spin"
                                  size={13}
                                />
                              ) : (
                                <Check size={13} strokeWidth={2.5} />
                              )}
                              ذخیره
                            </Button>
                          </div>
                        </div>
                      ) : (
                        message.body && (
                          <p className="whitespace-pre-wrap break-words text-[13.5px] leading-6 select-text">
                            {highlightMentions(
                              message.body,
                              members,
                              message.isOwn,
                            )}
                          </p>
                        )
                      )}

                      <div
                        className={`mt-0.5 flex items-center gap-1.5 text-[10px] ${
                          message.isOwn
                            ? "text-primary-foreground/75"
                            : "text-muted-foreground"
                        }`}
                      >
                        <time dateTime={message.createdAt}>
                          {timeFormatter.format(new Date(message.createdAt))}
                        </time>
                        {message.editedAt && <span>ویرایش‌شده</span>}
                        {editingId !== message.id &&
                          (message.canEdit || message.canDelete) && (
                            <span className="ms-auto flex items-center opacity-0 transition-opacity group-hover:opacity-100 max-lg:opacity-100">
                              {message.canEdit && (
                                <button
                                  type="button"
                                  onClick={() => beginEdit(message)}
                                  className="rounded p-1"
                                  title="ویرایش پیام"
                                  aria-label="ویرایش پیام"
                                >
                                  <Pencil size={13} />
                                </button>
                              )}
                              {message.canDelete && (
                                <button
                                  type="button"
                                  onClick={() => void deleteMessage(message)}
                                  disabled={deletingId === message.id}
                                  className="rounded p-1 disabled:opacity-50"
                                  title="حذف پیام"
                                  aria-label="حذف پیام"
                                >
                                  {deletingId === message.id ? (
                                    <LoaderCircle
                                      className="animate-spin"
                                      size={13}
                                    />
                                  ) : (
                                    <Trash2 size={13} />
                                  )}
                                </button>
                              )}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            );
          })
        )}
      </div>

      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-24 left-4 z-10 flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md"
          title="رفتن به پیام‌های جدید"
          aria-label="رفتن به پیام‌های جدید"
        >
          <ArrowDown size={16} strokeWidth={2.5} />
        </button>
      )}

      <form
        onSubmit={sendMessage}
        className="z-10 shrink-0 border-t border-border bg-card px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:px-3"
      >
        {imagePreview && (
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-muted/60 p-2">
            <img
              src={imagePreview}
              alt="پیش‌نمایش تصویر انتخابی"
              className="size-12 rounded-xl object-cover"
            />
            <p className="min-w-0 flex-1 truncate text-xs text-foreground">
              {image?.name}
            </p>
            <button
              type="button"
              onClick={() => {
                selectImage(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground"
              aria-label="حذف تصویر انتخابی"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div ref={composerRef} className="relative flex items-center gap-1">
          {emojiOpen && (
            <div className="absolute bottom-full start-0 z-20 mb-2 w-[min(100%,320px)] rounded-2xl border border-border bg-card p-2 shadow-lg">
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="flex size-9 items-center justify-center rounded-lg text-lg hover:bg-muted"
                    onClick={() => insertAtCursor(emoji)}
                    aria-label={`افزودن ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mention && !mentionDismissed && mentionMatches.length > 0 && (
            <ul className="absolute bottom-full start-12 z-20 mb-2 max-h-64 w-[min(100%-3rem,280px)] overflow-y-auto rounded-2xl border border-border bg-card py-1 shadow-lg">
              {mentionMatches.map((member, index) => (
                <li key={member.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-start ${
                      index === mentionIndex ? "bg-muted" : ""
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertMention(member);
                    }}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {member.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {member.name}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {roleLabel[member.role]}
                        {member.unit ? ` · واحد ${member.unit}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="chat-image"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              if (selected && selected.size > 8 * 1024 * 1024) {
                toast.error("حجم تصویر باید کمتر از ۸ مگابایت باشد.");
                event.target.value = "";
                return;
              }
              selectImage(selected);
            }}
          />

          <button
            type="button"
            onClick={() => setEmojiOpen((open) => !open)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="ایموجی"
            aria-expanded={emojiOpen}
          >
            <Smile size={22} />
          </button>

          <label
            htmlFor="chat-image"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="افزودن تصویر"
            title="افزودن تصویر"
          >
            <ImageIcon size={22} />
          </label>

          <label className="form-field chat-compose-field min-w-0 flex-1">
            <span>متن پیام</span>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                syncCaret(event.target);
                resizeComposer();
              }}
              onClick={(event) => syncCaret(event.currentTarget)}
              onKeyUp={(event) => syncCaret(event.currentTarget)}
              onKeyDown={onComposerKeyDown}
              maxLength={2_000}
              rows={1}
              placeholder=" "
              aria-label="متن پیام"
              className="form-control w-full"
            />
          </label>

          <button
            type="submit"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            disabled={sending || (!body.trim() && !image)}
            aria-label="ارسال پیام"
          >
            {sending ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <Send size={18} strokeWidth={2.25} className="-scale-x-100" />
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

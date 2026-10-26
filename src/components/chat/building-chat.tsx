/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ArrowDown,
  ArrowsClockwise,
  Check,
  ChatCircleDots,
  ImageSquare,
  PaperPlaneTilt,
  PencilSimple,
  SpinnerGap,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ChatMessageView } from "@/lib/chat";

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

async function responseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error && !/^[A-Z_]+$/.test(payload.error)
    ? payload.error
    : fallback;
}

export function BuildingChat({
  buildingName,
  initialMessages,
}: {
  buildingName: string;
  initialMessages?: ChatMessageView[];
}) {
  const [messages, setMessages] = useState<ChatMessageView[]>(
    initialMessages ?? [],
  );
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialMessages);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    initialMessages ? new Date() : null,
  );
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imagePreviewRef = useRef<string | null>(null);
  const followLatest = useRef(true);
  const initialized = useRef(Boolean(initialMessages?.length));

  const loadMessages = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch("/api/chat", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("LOAD_FAILED");
      const payload = (await response.json()) as {
        messages: ChatMessageView[];
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
      setLastUpdated(new Date());
    } catch {
      if (!quiet) toast.error("گفتگو دریافت نشد. لطفاً اتصال را بررسی کنید.");
    } finally {
      if (!quiet) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => void loadMessages(true), 5_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadMessages]);

  useEffect(() => {
    return () => {
      if (imagePreviewRef.current) {
        URL.revokeObjectURL(imagePreviewRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if ((!initialized.current || followLatest.current) && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
      initialized.current = true;
    }
  }, [messages]);

  function scrollToBottom() {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
      followLatest.current = true;
      setShowScrollBottom(false);
    }
  }

  function handleScroll(element: HTMLDivElement) {
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    followLatest.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);
  }

  function selectImage(selected: File | null) {
    if (imagePreviewRef.current) {
      URL.revokeObjectURL(imagePreviewRef.current);
    }
    const preview = selected ? URL.createObjectURL(selected) : null;
    imagePreviewRef.current = preview;
    setImage(selected);
    setImagePreview(preview);
  }

  function handleBodyChange(value: string) {
    setBody(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
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

  return (
    <section className="panel relative overflow-hidden border border-border shadow-xs">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3.5 backdrop-blur-xs sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ChatCircleDots size={22} weight="duotone" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                گفتگوی {buildingName}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                آنلاین
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              فضای تعامل، اطلاع‌رسانی و هماهنگی عمومی ساکنان و مدیریت
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            {lastUpdated
              ? `به‌روز تا ${timeFormatter.format(lastUpdated)}`
              : "در حال اتصال"}
          </span>
          <button
            type="button"
            onClick={() => void loadMessages(false)}
            disabled={refreshing}
            className="flex size-7 items-center justify-center rounded-lg border border-border/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="به‌روزرسانی پیام‌ها"
            aria-label="به‌روزرسانی پیام‌ها"
          >
            <ArrowsClockwise
              size={13}
              className={refreshing ? "animate-spin text-primary" : ""}
            />
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div
        ref={listRef}
        onScroll={(e) => handleScroll(e.currentTarget)}
        className="h-[46dvh] min-h-[340px] overflow-y-auto bg-muted/20 px-3 py-5 sm:h-[min(60dvh,620px)] sm:min-h-[420px] sm:px-6"
        aria-live="polite"
        aria-label="پیام‌های گروه ساختمان"
      >
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <SpinnerGap className="animate-spin text-primary" size={24} />
            <span>در حال بارگذاری گفتگو...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ChatCircleDots size={30} weight="duotone" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              هنوز پیامی ثبت نشده است
            </p>
            <p className="mt-1.5 max-w-sm text-xs leading-6 text-muted-foreground">
              نخستین پیام را ارسال کنید. هماهنگی‌های ساختمان، اعلانات شارژ و
              نظافت در این گفتگو به اشتراک گذاشته می‌شود.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const currentDayLabel = messageDay(message.createdAt);
            const prevDayLabel = previous
              ? messageDay(previous.createdAt)
              : null;
            const showDay = !previous || currentDayLabel !== prevDayLabel;

            return (
              <div key={message.id}>
                {showDay && currentDayLabel && (
                  <div className="my-5 flex items-center justify-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="rounded-full bg-muted px-3 py-0.5 text-[10px] font-medium text-muted-foreground shadow-2xs">
                      {currentDayLabel}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}

                <article
                  className={`mb-3.5 flex items-end gap-2.5 ${
                    message.isOwn ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar */}
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-2xs ring-1 ${
                      message.isOwn
                        ? "bg-primary text-primary-foreground ring-primary/30"
                        : "bg-card text-foreground ring-border"
                    }`}
                  >
                    {message.authorName.slice(0, 1)}
                  </span>

                  {/* Bubble Container */}
                  <div
                    className={`group flex max-w-[85%] flex-col sm:max-w-[70%] ${
                      message.isOwn ? "items-start" : "items-start"
                    }`}
                  >
                    {/* Author Meta */}
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {message.authorName}
                      </span>
                      {message.authorUnit && (
                        <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] text-muted-foreground">
                          واحد {message.authorUnit}
                        </span>
                      )}
                    </div>

                    {/* Bubble Content */}
                    <div
                      className={`relative w-fit max-w-full rounded-2xl border p-3 shadow-2xs transition-all ${
                        message.isOwn
                          ? "rounded-bl-xs border-primary/20 bg-secondary/85 text-foreground"
                          : "rounded-br-xs border-border bg-card text-foreground"
                      }`}
                    >
                      {/* Attached Image */}
                      {message.imageUrl && (
                        <a
                          href={message.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-2 block overflow-hidden rounded-xl bg-muted ring-1 ring-border transition-opacity hover:opacity-95"
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

                      {/* Message Body or Edit Field */}
                      {editingId === message.id ? (
                        <div className="min-w-[240px] max-w-full space-y-2 pt-0.5 sm:min-w-[300px]">
                          <textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void saveEdit(message);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingId(null);
                              }
                            }}
                            autoFocus
                            rows={3}
                            className="form-control form-textarea w-full bg-background text-xs leading-relaxed"
                            maxLength={2_000}
                            aria-label="ویرایش متن پیام"
                          />
                          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                            <span>Enter: ذخیره • Esc: انصراف</span>
                            <div className="flex items-center gap-1.5">
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
                                  <SpinnerGap
                                    className="animate-spin"
                                    size={13}
                                  />
                                ) : (
                                  <Check size={13} weight="bold" />
                                )}
                                ذخیره
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        message.body && (
                          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground select-text">
                            {message.body}
                          </p>
                        )
                      )}

                      {/* Footer: Timestamp, Edit badge, Actions */}
                      <div className="mt-1.5 flex items-center gap-2 text-[9px] text-muted-foreground">
                        <time dateTime={message.createdAt}>
                          {timeFormatter.format(new Date(message.createdAt))}
                        </time>
                        {message.editedAt && <span>(ویرایش‌شده)</span>}

                        {editingId !== message.id &&
                          (message.canEdit || message.canDelete) && (
                            <span className="ms-auto flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                              {message.canEdit && (
                                <button
                                  type="button"
                                  onClick={() => beginEdit(message)}
                                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  title="ویرایش پیام"
                                  aria-label="ویرایش پیام"
                                >
                                  <PencilSimple size={13} />
                                </button>
                              )}
                              {message.canDelete && (
                                <button
                                  type="button"
                                  onClick={() => void deleteMessage(message)}
                                  disabled={deletingId === message.id}
                                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                  title="حذف پیام"
                                  aria-label="حذف پیام"
                                >
                                  {deletingId === message.id ? (
                                    <SpinnerGap
                                      className="animate-spin"
                                      size={13}
                                    />
                                  ) : (
                                    <Trash size={13} />
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

      {/* Floating Scroll-to-bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-24 left-6 z-10 flex size-9 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-md transition-all hover:bg-muted active:scale-95"
          title="رفتن به پیام‌های جدید"
          aria-label="رفتن به پیام‌های جدید"
        >
          <ArrowDown size={16} weight="bold" />
        </button>
      )}

      {/* Message Input Form */}
      <form
        onSubmit={sendMessage}
        className="border-t border-border bg-card p-3 sm:p-4"
      >
        {/* Selected Image Preview */}
        {imagePreview && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-2">
            <img
              src={imagePreview}
              alt="پیش‌نمایش تصویر انتخابی"
              className="size-14 rounded-lg object-cover ring-1 ring-border"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {image?.name}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                تصویر بهینه شده و با فرمت WebP فشرده ارسال خواهد شد
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                selectImage(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              aria-label="حذف تصویر انتخابی"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* File Input */}
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

          <label
            htmlFor="chat-image"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-primary"
            aria-label="افزودن تصویر"
            title="افزودن تصویر (حداکثر ۸ مگابایت)"
          >
            <ImageSquare size={20} />
          </label>

          {/* Text Input */}
          <div className="min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => handleBodyChange(e.target.value)}
              onKeyDown={(e) => {
                // Enter without Shift sends immediately
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if ((body.trim() || image) && !sending) {
                    void sendMessage();
                  }
                }
              }}
              maxLength={2_000}
              rows={1}
              placeholder="پیام خود را بنویسید... (Enter برای ارسال، Shift+Enter خط جدید)"
              aria-label="متن پیام"
              className="form-control max-h-40 min-h-10 w-full resize-none bg-background py-2 px-3 text-xs leading-relaxed"
            />
          </div>

          {/* Send Button */}
          <Button
            type="submit"
            className="size-10 shrink-0 p-0 shadow-2xs"
            disabled={sending || (!body.trim() && !image)}
            aria-label="ارسال پیام"
            title="ارسال پیام (Enter)"
          >
            {sending ? (
              <SpinnerGap className="animate-spin" size={18} />
            ) : (
              <PaperPlaneTilt
                size={18}
                weight="fill"
                className="-scale-x-100"
              />
            )}
          </Button>
        </div>

        {/* Shortcuts & Counter Footer */}
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
          <span>ارسال: Enter • خط جدید: Shift + Enter</span>
          <span>{body.length.toLocaleString("fa-IR")} / ۲٬۰۰۰</span>
        </div>
      </form>
    </section>
  );
}

/* eslint-disable @next/next/no-img-element */
"use client";

import {
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
const dayFormatter = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran",
  weekday: "long",
  day: "numeric",
  month: "long",
});

function messageDay(value: string) {
  return dayFormatter.format(new Date(value));
}

async function responseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error && !/^[A-Z_]+$/.test(payload.error)
    ? payload.error
    : fallback;
}

export function BuildingChat({ buildingName }: { buildingName: string }) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imagePreviewRef = useRef<string | null>(null);
  const followLatest = useRef(true);
  const initialized = useRef(false);

  const loadMessages = useCallback(async (quiet = false) => {
    try {
      const response = await fetch("/api/chat", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("LOAD_FAILED");
      const payload = (await response.json()) as {
        messages: ChatMessageView[];
      };
      setMessages(payload.messages);
      setLastUpdated(new Date());
    } catch {
      if (!quiet) toast.error("گفتگو دریافت نشد. دوباره تلاش کنید.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadMessages(), 0);
    const interval = window.setInterval(() => void loadMessages(true), 5_000);
    return () => {
      window.clearTimeout(initialLoad);
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

  function selectImage(selected: File | null) {
    if (imagePreviewRef.current) {
      URL.revokeObjectURL(imagePreviewRef.current);
    }
    const preview = selected ? URL.createObjectURL(selected) : null;
    imagePreviewRef.current = preview;
    setImage(selected);
    setImagePreview(preview);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!body.trim() && !image) || sending) return;
    setSending(true);
    try {
      const form = new FormData();
      form.set("body", body.trim());
      if (image) form.set("image", image);
      const response = await fetch("/api/chat", { method: "POST", body: form });
      if (!response.ok) {
        throw new Error(await responseError(response, "پیام ارسال نشد."));
      }
      setBody("");
      selectImage(null);
      if (fileRef.current) fileRef.current.value = "";
      followLatest.current = true;
      await loadMessages(true);
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
      await loadMessages(true);
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
      await loadMessages(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "پیام حذف نشد.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <ChatCircleDots size={22} weight="duotone" />
          </span>
          <div>
            <h2 className="text-sm font-bold">گفتگوی {buildingName}</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              پیام‌ها برای همه اعضای ساختمان قابل مشاهده است
            </p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {lastUpdated
            ? `به‌روز تا ${timeFormatter.format(lastUpdated)}`
            : "در حال همگام‌سازی"}
        </span>
      </header>

      <div
        ref={listRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          followLatest.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            100;
        }}
        className="h-[42dvh] min-h-[320px] overflow-y-auto bg-muted/30 px-3 py-5 sm:h-[min(62dvh,640px)] sm:min-h-[420px] sm:px-6"
        aria-live="polite"
        aria-label="پیام‌های گروه ساختمان"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            <SpinnerGap className="me-2 animate-spin" size={18} />
            در حال دریافت گفتگو...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
              <ChatCircleDots size={30} weight="duotone" />
            </span>
            <p className="text-sm font-semibold">هنوز پیامی ثبت نشده است</p>
            <p className="mt-2 max-w-sm text-xs leading-7 text-muted-foreground">
              اولین پیام را بفرستید؛ اطلاع‌رسانی‌های عمومی و هماهنگی همسایه‌ها
              می‌تواند همین‌جا انجام شود.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const showDay =
              !previous ||
              messageDay(previous.createdAt) !== messageDay(message.createdAt);
            return (
              <div key={message.id}>
                {showDay && (
                  <div className="my-5 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    {messageDay(message.createdAt)}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                <article
                  className={`mb-3 flex items-end gap-2 ${message.isOwn ? "flex-row-reverse" : ""}`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold text-primary shadow-sm ring-1 ring-border">
                    {message.authorName.slice(0, 1)}
                  </span>
                  <div
                    className={`group max-w-[86%] sm:max-w-[72%] ${message.isOwn ? "items-end" : "items-start"}`}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 px-1 text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {message.isOwn ? "شما" : message.authorName}
                      </span>
                      {message.authorUnit && (
                        <span>واحد {message.authorUnit}</span>
                      )}
                      {message.authorRole === "manager" && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-primary">
                          مدیر
                        </span>
                      )}
                    </div>
                    <div
                      className={`rounded-2xl border p-3 shadow-sm ${message.isOwn ? "rounded-bl-md border-primary/20 bg-secondary" : "rounded-br-md border-border bg-card"}`}
                    >
                      {message.imageUrl && (
                        <a
                          href={message.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-3 block overflow-hidden rounded-xl bg-muted"
                        >
                          <img
                            src={message.imageUrl}
                            alt={message.imageName || "تصویر پیام"}
                            className="max-h-80 w-full object-contain"
                          />
                        </a>
                      )}
                      {editingId === message.id ? (
                        <div className="min-w-[240px] space-y-2">
                          <textarea
                            value={editBody}
                            onChange={(event) =>
                              setEditBody(event.target.value)
                            }
                            className="form-control form-textarea min-h-24 w-full bg-card text-xs"
                            maxLength={2_000}
                            aria-label="ویرایش متن پیام"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              انصراف
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void saveEdit(message)}
                              disabled={savingId === message.id}
                            >
                              <Check size={14} />
                              ذخیره
                            </Button>
                          </div>
                        </div>
                      ) : (
                        message.body && (
                          <p className="whitespace-pre-wrap break-words text-xs leading-7">
                            {message.body}
                          </p>
                        )
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[9px] text-muted-foreground">
                        <time dateTime={message.createdAt}>
                          {timeFormatter.format(new Date(message.createdAt))}
                        </time>
                        {message.editedAt && <span>ویرایش‌شده</span>}
                        {editingId !== message.id &&
                          (message.canEdit || message.canDelete) && (
                            <span className="ms-auto flex items-center gap-1">
                              {message.canEdit && (
                                <button
                                  type="button"
                                  onClick={() => beginEdit(message)}
                                  className="rounded-md p-1.5 hover:bg-card hover:text-primary"
                                  aria-label="ویرایش پیام"
                                >
                                  <PencilSimple size={14} />
                                </button>
                              )}
                              {message.canDelete && (
                                <button
                                  type="button"
                                  onClick={() => void deleteMessage(message)}
                                  disabled={deletingId === message.id}
                                  className="rounded-md p-1.5 hover:bg-card hover:text-destructive disabled:opacity-50"
                                  aria-label="حذف پیام"
                                >
                                  {deletingId === message.id ? (
                                    <SpinnerGap
                                      className="animate-spin"
                                      size={14}
                                    />
                                  ) : (
                                    <Trash size={14} />
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

      <form
        onSubmit={sendMessage}
        className="border-t border-border bg-card p-3 sm:p-4"
      >
        {imagePreview && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-2">
            <img
              src={imagePreview}
              alt="پیش‌نمایش تصویر انتخابی"
              className="size-16 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{image?.name}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                تصویر پیش از ارسال بهینه می‌شود
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                selectImage(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-destructive"
              aria-label="حذف تصویر انتخابی"
            >
              <X size={17} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
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
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            aria-label="افزودن تصویر"
            title="افزودن تصویر"
          >
            <ImageSquare size={21} />
          </label>
          <div className="min-w-0 flex-1">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={2_000}
              rows={1}
              placeholder="پیام خود را بنویسید..."
              aria-label="متن پیام"
              className="form-control max-h-36 min-h-11 w-full resize-none bg-background py-2.5 text-xs"
            />
          </div>
          <Button
            type="submit"
            className="size-11 shrink-0 px-0"
            disabled={sending || (!body.trim() && !image)}
            aria-label="ارسال پیام"
            title="ارسال پیام"
          >
            {sending ? (
              <SpinnerGap className="animate-spin" size={19} />
            ) : (
              <PaperPlaneTilt size={19} weight="fill" />
            )}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[9px] text-muted-foreground">
          <span>ارسال سریع: Ctrl + Enter</span>
          <span>{body.length.toLocaleString("fa-IR")} / ۲٬۰۰۰</span>
        </div>
      </form>
    </section>
  );
}

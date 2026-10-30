import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {};
  const show = vi
      .fn<
        (
          title: string,
          options: { body: string; data: { url: string }; tag?: string },
        ) => Promise<void>
      >()
      .mockResolvedValue(undefined),
    open = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
  const self = {
    location: { origin: "https://vahedban.test" },
    addEventListener: (name: string, callback: (typeof handlers)[string]) => {
      handlers[name] = callback;
    },
    registration: { showNotification: show },
    clients: {
      claim: async () => {},
      matchAll: async () => [],
      openWindow: open,
    },
    skipWaiting: () => {},
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self,
    URL,
    Response,
    fetch: request,
  });
  return { handlers, show, open, request };
}
describe("background web push", () => {
  it("shows a native notification without an open app and retains its deep link", async () => {
    const w = worker();
    let pending: Promise<unknown> | undefined;
    w.handlers.push({
      data: {
        json: () => ({
          title: "سررسید",
          body: "پیام",
          url: "/resident/invoices",
          tag: "id",
        }),
      },
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    await pending;
    expect(w.show).toHaveBeenCalledWith(
      "سررسید",
      expect.objectContaining({
        body: "پیام",
        data: { url: "/resident/invoices" },
        tag: "id",
      }),
    );
  });
  it("rejects external links in push payloads", async () => {
    const w = worker();
    let pending: Promise<unknown> | undefined;
    w.handlers.push({
      data: { json: () => ({ url: "https://evil.test" }) },
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
    expect(w.show.mock.calls[0][1].data.url).toBe("/");
  });
  it("opens the app when a notification is tapped", async () => {
    const w = worker(),
      close = vi.fn();
    let pending: Promise<unknown> | undefined;
    w.handlers.notificationclick({
      notification: { close, data: { url: "/manager/bills" } },
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
    expect(close).toHaveBeenCalled();
    expect(w.open).toHaveBeenCalledWith("https://vahedban.test/manager/bills");
  });
  it("marks only the tapped notification read without waiting to open the app", async () => {
    const w = worker();
    let pending: Promise<unknown> | undefined;
    w.handlers.notificationclick({
      notification: {
        close: vi.fn(),
        tag: "notice-test",
        data: { url: "/resident/notifications" },
      },
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
    expect(w.request).toHaveBeenCalledWith(
      "/api/notifications/read",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ id: "notice-test" }),
      }),
    );
    expect(w.open).toHaveBeenCalledWith(
      "https://vahedban.test/resident/notifications",
    );
  });
});

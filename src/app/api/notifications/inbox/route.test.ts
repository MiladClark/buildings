import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: mocks.session }));
vi.mock("@/lib/notifications/inbox", () => ({
  getNotificationPreview: mocks.preview,
}));
import { GET } from "./route";

beforeEach(() => {
  mocks.session.mockReset();
  mocks.preview.mockReset();
});
it("requires authentication before reading the inbox", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(mocks.preview).not.toHaveBeenCalled();
});
it("uses the signed-in user and prevents shared caching", async () => {
  mocks.session.mockResolvedValue({ user: { id: "own-user" } });
  const inbox = { all: [], unread: [], unreadCount: 0 };
  mocks.preview.mockResolvedValue(inbox);
  const response = await GET();
  expect(mocks.preview).toHaveBeenCalledExactlyOnceWith("own-user");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual(inbox);
});

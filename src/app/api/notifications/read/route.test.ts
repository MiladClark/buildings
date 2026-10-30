import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: mocks.session }));
vi.mock("@/lib/actions/notifications", () => ({
  markNotificationRead: mocks.read,
}));
import { POST } from "./route";

beforeEach(() => {
  mocks.session.mockReset().mockResolvedValue({ user: { id: "resident" } });
  mocks.read.mockReset().mockResolvedValue(undefined);
});
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3300/api/notifications/read", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3300",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
describe("notification click authentication", () => {
  it("rejects foreign origins before resolving a session", async () => {
    expect(
      (
        await POST(
          request({ id: "notice" }, { Origin: "https://untrusted.test" }),
        )
      ).status,
    ).toBe(403);
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("accepts the public HTTPS origin behind the deployment proxy", async () => {
    expect(
      (
        await POST(
          request(
            { id: "notice" },
            {
              Origin: "https://vahedban.test",
              "X-Forwarded-Host": "vahedban.test",
              "X-Forwarded-Proto": "https",
            },
          ),
        )
      ).status,
    ).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith("notice");
  });
  it("requires a signed-in account", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request({ id: "notice" }))).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([{}, { id: "" }, { id: 1 }])(
    "cannot turn malformed clicks into reading all notices: %j",
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.read).not.toHaveBeenCalled();
    },
  );
});

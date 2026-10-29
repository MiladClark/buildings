import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), handler: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { query: { user: { findFirst: mocks.find } } },
}));
vi.mock("@/lib/auth", () => ({ auth: { handler: mocks.handler } }));
import { POST } from "./route";

beforeEach(() => {
  mocks.find.mockReset();
  mocks.handler.mockReset();
  mocks.handler.mockResolvedValue(
    Response.json(
      { ok: true },
      { headers: { "Set-Cookie": "test-signed-session" } },
    ),
  );
});
function request(body: unknown, origin = "http://localhost:3300") {
  return new Request("http://localhost:3300/api/auth/sign-in/identifier", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}
describe("phone/email password login", () => {
  it("resolves a normalized phone to its current Google email and preserves the auth handler's cookies", async () => {
    mocks.find.mockResolvedValue({ email: "resident@example.com" });
    const response = await POST(
      request({ identifier: "+۹۸۹۱۲۳۴۵۶۷۸۹", password: "password" }),
    );
    const forwarded = mocks.handler.mock.calls[0][0] as Request;
    expect(new URL(forwarded.url).pathname).toBe("/api/auth/sign-in/email");
    expect(await forwarded.json()).toEqual({
      email: "resident@example.com",
      password: "password",
    });
    expect(response.headers.get("Set-Cookie")).toBe("test-signed-session");
    expect(await response.json()).toEqual({ ok: true });
  });
  it("treats Persian digits in the email and password as English digits", async () => {
    await POST(
      request({
        identifier: "User۱۲@Example.com",
        password: "secret۱۲۳",
      }),
    );
    expect(await (mocks.handler.mock.calls[0][0] as Request).json()).toEqual({
      email: "user12@example.com",
      password: "secret123",
    });
  });
  it("rejects a password written with Persian letters", async () => {
    const response = await POST(
      request({ identifier: "09123456789", password: "رمزعبور۱۲" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: expect.stringMatching(/انگلیسی/),
    });
    expect(mocks.handler).not.toHaveBeenCalled();
  });
  it("keeps existing email login working", async () => {
    await POST(
      request({ identifier: "  Manager@Example.com ", password: "password" }),
    );
    expect(mocks.find).not.toHaveBeenCalled();
    expect(await (mocks.handler.mock.calls[0][0] as Request).json()).toEqual({
      email: "manager@example.com",
      password: "password",
    });
  });
  it.each([
    null,
    {},
    { identifier: 123, password: "password" },
    { identifier: "bad", password: "password" },
  ])("rejects malformed input: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.handler).not.toHaveBeenCalled();
  });
  it("rejects foreign origins before looking up identities", async () => {
    expect(
      (
        await POST(
          request(
            { identifier: "09123456789", password: "password" },
            "https://attacker.example",
          ),
        )
      ).status,
    ).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.handler).not.toHaveBeenCalled();
  });
});

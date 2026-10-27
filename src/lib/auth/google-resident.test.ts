import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq, sql } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { serializeSignedCookie } from "better-call";

vi.mock("@/lib/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  const client = new PGlite();
  return { db: drizzle(client, { schema }), client };
});
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
  unstable_cache: (fn: () => unknown) => fn,
}));
vi.mock("@/lib/actions/building", () => ({ ensureFirstManager: vi.fn() }));
vi.mock("@/lib/session", () => ({
  requireManager: async () => ({ member: { buildingId: "building" } }),
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    $context: Promise.resolve({
      password: { hash: async () => "test-only-hash" },
    }),
    api: { signInEmail: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { connectGoogleResident } from "./google-resident";
import { residentConnection } from "./resident-plugin";
import {
  deleteResidentShell,
  registerWithPhone,
  resetResidentPassword,
} from "@/lib/actions/resident-accounts";

const phone = "09123456789";
const input = {
  userId: "google-user",
  sessionToken: "original-token",
  phone,
  unitId: "one",
};
const now = new Date();
const secret = "test-only-secret-at-least-thirty-two-characters";
const httpAuth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: s,
    transaction: true,
  }),
  baseURL: "http://localhost:3300",
  secret,
  advanced: { disableOriginCheck: false, disableCSRFCheck: false },
  user: { additionalFields: { phone: { type: "string", input: false } } },
  plugins: [residentConnection()],
  rateLimit: { enabled: false },
});

beforeAll(async () => {
  const { client } = (await import("@/lib/db")) as unknown as {
    client: import("@electric-sql/pglite").PGlite;
  };
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle/postgresql" });
});
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE "user", building CASCADE`);
  await db.insert(s.building).values({ id: "building", name: "آزمایش" });
  await db.insert(s.unit).values([
    { id: "one", buildingId: "building", label: "۱" },
    { id: "two", buildingId: "building", label: "۲" },
  ]);
  await db.insert(s.user).values([
    {
      id: "shell",
      name: "نام ثبت‌شده مدیر",
      phone,
      email: `${phone}@residents.internal`,
    },
    {
      id: "google-user",
      name: "Google Name",
      email: "resident@example.com",
      emailVerified: true,
    },
  ]);
  await db.insert(s.membership).values({
    id: "resident-membership",
    userId: "shell",
    buildingId: "building",
    unitId: "one",
    role: "resident",
  });
  await db.insert(s.account).values({
    id: "google-account",
    userId: "google-user",
    accountId: "google-subject",
    providerId: "google",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(s.session).values({
    id: "google-session",
    userId: "google-user",
    token: "original-token",
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(s.paymentRequest).values({
    id: "prior-request",
    unitId: "one",
    userId: "shell",
    amountRial: 7500000,
    note: "سابقه واقعی حساب",
  });
});
afterAll(async () => {
  const { client } = (await import("@/lib/db")) as unknown as {
    client: import("@electric-sql/pglite").PGlite;
  };
  await client.close();
});

async function remainsUnchanged() {
  expect(
    await db.query.user.findFirst({ where: eq(s.user.id, "shell") }),
  ).toMatchObject({ phone, email: `${phone}@residents.internal` });
  expect(
    await db.query.account.findFirst({
      where: eq(s.account.id, "google-account"),
    }),
  ).toMatchObject({ userId: "google-user" });
  expect(
    await db.query.session.findFirst({
      where: eq(s.session.id, "google-session"),
    }),
  ).toMatchObject({ userId: "google-user", token: "original-token" });
}

describe("Google identity connects to the exact existing resident", () => {
  it("preserves the canonical user, manager name, membership and financial references; rotates the session", async () => {
    const result = await connectGoogleResident({
      ...input,
      phone: "+۹۸۹۱۲۳۴۵۶۷۸۹",
    });
    expect(result.user).toMatchObject({
      id: "shell",
      name: "نام ثبت‌شده مدیر",
      email: "resident@example.com",
      emailVerified: true,
      phone,
    });
    expect(result.session.userId).toBe("shell");
    expect(result.session.token).not.toBe("original-token");
    expect(
      await db.query.user.findFirst({ where: eq(s.user.id, "google-user") }),
    ).toBeUndefined();
    expect(await db.query.membership.findFirst()).toMatchObject({
      id: "resident-membership",
      userId: "shell",
      unitId: "one",
    });
    expect(await db.query.paymentRequest.findFirst()).toMatchObject({
      id: "prior-request",
      userId: "shell",
      amountRial: 7500000,
    });
    expect(await db.query.account.findFirst()).toMatchObject({
      userId: "shell",
      accountId: "google-subject",
    });
    await expect(
      connectGoogleResident({
        ...input,
        userId: "shell",
        sessionToken: result.session.token,
      }),
    ).resolves.toMatchObject({ user: { id: "shell" } });
    await expect(connectGoogleResident(input)).rejects.toMatchObject({
      code: "GOOGLE_REQUIRED",
    });
  });
  it("stores the resident's name and unit when the manager left the unit empty", async () => {
    await db.update(s.membership).set({ unitId: null });
    const result = await connectGoogleResident({
      ...input,
      unitId: "two",
      firstName: "رضا",
      lastName: "پاکدامن",
    });
    expect(result.user).toMatchObject({
      id: "shell",
      name: "رضا پاکدامن",
      phone,
    });
    expect(await db.query.membership.findFirst()).toMatchObject({
      userId: "shell",
      unitId: "two",
    });
  });
  it.each([{ phone: "09111111111" }, { unitId: "two" }, { unitId: "" }])(
    "rejects a mismatched phone/unit: %j",
    async (override) => {
      await expect(
        connectGoogleResident({ ...input, ...override }),
      ).rejects.toMatchObject({ code: "NOT_MATCHED" });
      await remainsUnchanged();
    },
  );
  it.each(["password", "google"])(
    "cannot take over an activated %s account",
    async (kind) => {
      await db.insert(s.account).values({
        id: "existing-account",
        userId: "shell",
        accountId: "existing",
        providerId: kind === "password" ? "credential" : "google",
        password: kind === "password" ? "existing-hash" : null,
        createdAt: now,
        updatedAt: now,
      });
      await expect(connectGoogleResident(input)).rejects.toMatchObject({
        code: "USE_PASSWORD",
      });
      await remainsUnchanged();
    },
  );
  it.each([
    "expired",
    "unverified",
    "non-google",
    "manager",
    "deleted-unit",
    "foreign-unit",
  ])("rejects %s", async (kind) => {
    if (kind === "expired")
      await db.update(s.session).set({ expiresAt: new Date(0) });
    if (kind === "unverified")
      await db
        .update(s.user)
        .set({ emailVerified: false })
        .where(eq(s.user.id, "google-user"));
    if (kind === "non-google")
      await db.update(s.account).set({ providerId: "credential" });
    if (kind === "manager")
      await db.update(s.membership).set({ role: "manager" });
    if (kind === "deleted-unit")
      await db
        .update(s.unit)
        .set({ deletedAt: new Date() })
        .where(eq(s.unit.id, "one"));
    if (kind === "foreign-unit") {
      await db.insert(s.building).values({ id: "foreign", name: "دیگر" });
      await db
        .update(s.unit)
        .set({ buildingId: "foreign" })
        .where(eq(s.unit.id, "one"));
    }
    await expect(connectGoogleResident(input)).rejects.toThrow();
    await remainsUnchanged();
  });
});

describe("signed HTTP session boundary", () => {
  async function cookie() {
    return (
      await serializeSignedCookie(
        "better-auth.session_token",
        "original-token",
        secret,
      )
    ).split(";")[0];
  }
  async function post(headers: Record<string, string> = {}) {
    return httpAuth.handler(
      new Request("http://localhost:3300/api/auth/resident/complete-google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3300",
          ...headers,
        },
        body: JSON.stringify({ phone, unitId: "one" }),
      }),
    );
  }
  it("rejects anonymous and cross-origin requests", async () => {
    expect((await post()).status).toBe(401);
    expect(
      (
        await post({
          Cookie: await cookie(),
          Origin: "https://attacker.example",
        })
      ).status,
    ).toBe(403);
    await remainsUnchanged();
  });
  it("issues a signed cookie for the canonical user; old token loses access", async () => {
    const oldCookie = await cookie();
    const response = await post({ Cookie: oldCookie });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const newCookie = response.headers
      .getSetCookie()
      .filter((item) => item.startsWith("better-auth.session_token="))
      .at(-1)
      ?.split(";")[0];
    expect(newCookie).toBeTruthy();
    const read = (cookie: string) =>
      httpAuth.handler(
        new Request("http://localhost:3300/api/auth/get-session", {
          headers: { Cookie: cookie },
        }),
      );
    expect(await (await read(oldCookie)).json()).toBeNull();
    expect(await (await read(newCookie!)).json()).toMatchObject({
      user: { id: "shell", phone },
      session: { userId: "shell" },
    });
  });
  it("limits repeated attempts to match a phone and unit", async () => {
    const limited = betterAuth({
      ...httpAuth.options,
      rateLimit: { enabled: true, window: 60, max: 1000 },
    });
    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await limited.handler(
        new Request("http://localhost:3300/api/auth/resident/complete-google", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:3300",
            Cookie: await cookie(),
            "x-forwarded-for": "192.0.2.25",
          },
          body: JSON.stringify({ phone, unitId: "two" }),
        }),
      );
      expect(response.status).toBe(attempt < 5 ? 400 : 429);
    }
    await remainsUnchanged();
  });
});

describe("OAuth callback and repeat sign-in through the actual auth handler", () => {
  it.each(["new resident", "existing password", "existing manager"])(
    "validates Google OAuth, connects %s and preserves the canonical user on later sign-in",
    async (mode) => {
      await db.delete(s.user).where(eq(s.user.id, "google-user"));
      const { generateKeyPair, exportJWK, SignJWT } = await import("jose");
      const { publicKey, privateKey } = await generateKeyPair("RS256");
      const jwk = {
        ...(await exportJWK(publicKey)),
        kid: "test-google-key",
        alg: "RS256",
        use: "sig",
      };
      const clientId = "test-google-client.apps.googleusercontent.com";
      const idToken = await new SignJWT({
        sub: "google-subject",
        email: "resident@example.com",
        name: "Google Name",
        email_verified: true,
      })
        .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
        .setIssuer("https://accounts.google.com")
        .setAudience(clientId)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      const googleFetch = vi.fn(async (resource: string | URL | Request) => {
        const url =
          resource instanceof Request ? resource.url : String(resource);
        if (url === "https://oauth2.googleapis.com/token")
          return Response.json({
            access_token: "test-access-token",
            token_type: "Bearer",
            expires_in: 3600,
            id_token: idToken,
          });
        if (url === "https://www.googleapis.com/oauth2/v3/certs")
          return Response.json({ keys: [jwk] });
        throw new Error(`Unexpected test network request: ${url}`);
      });
      vi.stubGlobal("fetch", googleFetch);
      try {
        const oauth = betterAuth({
          ...httpAuth.options,
          emailAndPassword: { enabled: true },
          socialProviders: {
            google: {
              clientId,
              clientSecret: "test-only-client-secret",
              prompt: "select_account",
            },
          },
          account: {
            accountLinking: {
              enabled: true,
              trustedProviders: ["google"],
              allowDifferentEmails: true,
              disableImplicitLinking: false,
              requireLocalEmailVerified: false,
            },
          },
        });
        async function signIn(linkCookie?: string) {
          const start = await oauth.handler(
            new Request(
              `http://localhost:3300/api/auth/${linkCookie ? "link-social" : "sign-in/social"}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Origin: "http://localhost:3300",
                  ...(linkCookie ? { Cookie: linkCookie } : {}),
                },
                body: JSON.stringify({
                  provider: "google",
                  callbackURL: "/login?connected=1",
                  errorCallbackURL: "/login?error=google",
                }),
              },
            ),
          );
          expect(start.status).toBe(200);
          const { url } = await start.json();
          const provider = new URL(url);
          expect(provider.origin).toBe("https://accounts.google.com");
          expect(provider.searchParams.get("client_id")).toBe(clientId);
          expect(provider.searchParams.get("code_challenge_method")).toBe(
            "S256",
          );
          const cookies = [
            linkCookie,
            ...start.headers
              .getSetCookie()
              .map((cookie) => cookie.split(";")[0]),
          ]
            .filter(Boolean)
            .join("; ");
          const callback = new URL(
            "http://localhost:3300/api/auth/callback/google",
          );
          callback.searchParams.set(
            "state",
            provider.searchParams.get("state")!,
          );
          callback.searchParams.set("code", "test-authorization-code");
          const finish = await oauth.handler(
            new Request(callback, { headers: { Cookie: cookies } }),
          );
          expect(finish.status).toBe(302);
          expect(finish.headers.get("Location")).toContain(
            "/login?connected=1",
          );
          return (
            finish.headers
              .getSetCookie()
              .filter((cookie) =>
                cookie.startsWith("better-auth.session_token="),
              )
              .at(-1)
              ?.split(";")[0] ?? linkCookie!
          );
        }
        if (mode === "existing manager") {
          await db
            .update(s.user)
            .set({
              email: "resident@example.com",
              emailVerified: false,
              name: "میلاد رضاپور",
            })
            .where(eq(s.user.id, "shell"));
          await db.update(s.membership).set({ role: "manager" });
          await db.insert(s.account).values({
            id: "password-account",
            accountId: "shell",
            userId: "shell",
            providerId: "credential",
            password: "existing-hash",
            createdAt: now,
            updatedAt: now,
          });
          await signIn();
        } else if (mode === "existing password") {
          const hash = await (
            await oauth.$context
          ).password.hash("existing-password");
          await db.insert(s.account).values({
            id: "password-account",
            accountId: "shell",
            userId: "shell",
            providerId: "credential",
            password: hash,
            createdAt: now,
            updatedAt: now,
          });
          const login = await oauth.handler(
            new Request("http://localhost:3300/api/auth/sign-in/email", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Origin: "http://localhost:3300",
              },
              body: JSON.stringify({
                email: `${phone}@residents.internal`,
                password: "existing-password",
              }),
            }),
          );
          expect(login.status).toBe(200);
          const passwordCookie = login.headers
            .getSetCookie()
            .filter((cookie) => cookie.startsWith("better-auth.session_token="))
            .at(-1)!
            .split(";")[0];
          await signIn(passwordCookie);
          expect(
            await db.query.account.findFirst({
              where: eq(s.account.id, "password-account"),
            }),
          ).toMatchObject({ userId: "shell", password: hash });
        } else {
          const cookie = await signIn();
          const first = await db.query.user.findFirst({
            where: eq(s.user.email, "resident@example.com"),
          });
          expect(first).toMatchObject({ emailVerified: true });
          expect(first?.id).not.toBe("shell");
          const complete = await oauth.handler(
            new Request(
              "http://localhost:3300/api/auth/resident/complete-google",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Origin: "http://localhost:3300",
                  Cookie: cookie,
                },
                body: JSON.stringify({ phone, unitId: "one" }),
              },
            ),
          );
          expect(complete.status).toBe(200);
        }
        const returningCookie = await signIn();
        const returning = await oauth.handler(
          new Request("http://localhost:3300/api/auth/get-session", {
            headers: { Cookie: returningCookie },
          }),
        );
        expect(await returning.json()).toMatchObject({
          user: { id: "shell", phone },
          session: { userId: "shell" },
        });
        expect(await db.query.user.findMany()).toHaveLength(1);
        expect(await db.query.paymentRequest.findFirst()).toMatchObject({
          userId: "shell",
          amountRial: 7500000,
        });
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );
});

describe("password activation remains compatible", () => {
  it("cannot reassign a prepared phone to another unit", async () => {
    expect(
      await registerWithPhone({
        phone,
        password: "new-password",
        unitId: "two",
      }),
    ).toMatchObject({ ok: false });
    expect(await db.query.membership.findFirst()).toMatchObject({
      unitId: "one",
    });
    expect(
      await db.query.account.findMany({ where: eq(s.account.userId, "shell") }),
    ).toHaveLength(0);
  });
  it("does not create an account when the manager left the unit empty", async () => {
    await db.update(s.membership).set({ unitId: null });
    expect(
      await registerWithPhone({
        phone,
        password: "new-password",
        firstName: "نگار",
        lastName: "کریمی",
        unitId: "two",
      }),
    ).toMatchObject({
      ok: false,
      message: "شماره تلفن و واحد با حسابی که مدیر ساخته یکی نیست.",
    });
    expect(await db.query.membership.findFirst()).toMatchObject({
      unitId: null,
    });
    expect(
      await db.query.account.findMany({ where: eq(s.account.userId, "shell") }),
    ).toHaveLength(0);
  });
  it("activates the matching shell with password", async () => {
    expect(
      await registerWithPhone({
        phone,
        password: "new-password",
        unitId: "one",
      }),
    ).toEqual({ ok: true });
    expect(
      await db.query.account.findFirst({
        where: eq(s.account.userId, "shell"),
      }),
    ).toMatchObject({ providerId: "credential", password: "test-only-hash" });
  });
  it("rejects a phone the manager has not prepared", async () => {
    expect(
      await registerWithPhone({
        phone: "09111111111",
        password: "new-password",
        unitId: "one",
      }),
    ).toMatchObject({
      ok: false,
      message:
        "این شماره در فهرست مدیر نیست. ابتدا باید مدیر ساختمان حساب را بسازد.",
    });
    expect(await db.query.user.findMany()).toHaveLength(2);
  });
  it("reconnects the same account after the manager resets the password", async () => {
    expect(
      await registerWithPhone({
        phone,
        password: "new-password",
        unitId: "one",
        firstName: "نام",
        lastName: "قبلی",
      }),
    ).toEqual({ ok: true });
    await resetResidentPassword("shell");
    expect(
      await db.query.account.findMany({ where: eq(s.account.userId, "shell") }),
    ).toHaveLength(0);
    expect(
      await registerWithPhone({
        phone,
        password: "another-password",
        unitId: "one",
        firstName: "میلاد",
        lastName: "رضاپور",
      }),
    ).toEqual({ ok: true });
    expect(
      await db.query.user.findFirst({ where: eq(s.user.id, "shell") }),
    ).toMatchObject({ id: "shell", name: "میلاد رضاپور", phone });
    expect(await db.query.paymentRequest.findFirst()).toMatchObject({
      userId: "shell",
      amountRial: 7500000,
    });
  });
  it("cannot overwrite or delete a Google resident", async () => {
    await connectGoogleResident(input);
    expect(
      await registerWithPhone({
        phone,
        password: "new-password",
        unitId: "one",
      }),
    ).toMatchObject({ ok: false });
    await expect(deleteResidentShell("shell")).rejects.toThrow();
    expect(
      await db.query.user.findFirst({ where: eq(s.user.id, "shell") }),
    ).toBeDefined();
  });
});

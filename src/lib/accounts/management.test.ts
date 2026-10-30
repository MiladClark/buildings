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
vi.mock("@/lib/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  const client = new PGlite();
  return { db: drizzle(client, { schema }), client };
});
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import {
  addBuildingAccount,
  changeBuildingRole,
  setManagedPassword,
} from "./management";
import { updateAccountProfile, setOwnAccountPassword } from "./profile";
const httpAuth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: s,
    transaction: true,
  }),
  baseURL: "http://localhost:3300",
  secret: "local-test-secret-not-for-real-deployments",
  emailAndPassword: { enabled: true },
  rateLimit: { enabled: false },
});
const now = () => new Date();
let managerHash: string, otherHash: string;
beforeAll(async () => {
  const { client } = (await import("@/lib/db")) as unknown as {
    client: import("@electric-sql/pglite").PGlite;
  };
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle/postgresql" });
  const { password } = await httpAuth.$context;
  managerHash = await password.hash("Manager-test-1405!");
  otherHash = await password.hash("Resident-test-1405!");
});
afterAll(async () => {
  const { client } = (await import("@/lib/db")) as unknown as {
    client: import("@electric-sql/pglite").PGlite;
  };
  await client.close();
});
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE "user", building CASCADE`);
  await db.insert(s.building).values([
    { id: "building", name: "آزمایش" },
    { id: "foreign", name: "دیگر" },
  ]);
  await db.insert(s.unit).values([
    { id: "one", buildingId: "building", label: "۱" },
    { id: "two", buildingId: "building", label: "۲" },
    { id: "foreign-unit", buildingId: "foreign", label: "۱" },
  ]);
  await db
    .insert(s.user)
    .values({ id: "manager", name: "مدیر", email: "manager@test.local" });
  await db.insert(s.membership).values({
    id: "manager-member",
    userId: "manager",
    buildingId: "building",
    role: "manager",
  });
  await db.insert(s.account).values({
    id: "manager-credential",
    userId: "manager",
    accountId: "manager",
    providerId: "credential",
    password: managerHash,
    createdAt: now(),
    updatedAt: now(),
  });
  await loginSession("manager");
});
async function loginSession(userId: string) {
  await db.insert(s.session).values({
    id: `${userId}-session`,
    userId,
    token: `${userId}-token`,
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: now(),
    updatedAt: now(),
  });
}
async function resident(
  active = false,
  buildingId = "building",
  role: "manager" | "resident" = "resident",
) {
  await db.insert(s.user).values({
    id: "resident",
    name: "همسایه",
    phone: "09123456789",
    email: "09123456789@residents.internal",
  });
  await db.insert(s.membership).values({
    id: "resident-member",
    userId: "resident",
    buildingId,
    unitId: buildingId === "foreign" ? "foreign-unit" : "one",
    role,
  });
  if (active) {
    await db.insert(s.account).values({
      id: "resident-credential",
      userId: "resident",
      accountId: "resident",
      providerId: "credential",
      password: otherHash,
      createdAt: now(),
      updatedAt: now(),
    });
    await loginSession("resident");
  }
}
const add = (input: Partial<Parameters<typeof addBuildingAccount>[2]> = {}) =>
  db.transaction((tx) =>
    addBuildingAccount(tx, "manager", {
      phone: "09123456789",
      name: "مدیر دوم",
      role: "manager",
      unitId: null,
      passwordHash: otherHash,
      ...input,
    }),
  );
const change = (
  id: string,
  role: "manager" | "resident",
  unitId: string | null = "one",
  hash?: string,
  actor = "manager",
) =>
  db.transaction((tx) => changeBuildingRole(tx, actor, id, role, unitId, hash));
const profile = async (
  input: Partial<Parameters<typeof updateAccountProfile>[3]> = {},
) =>
  db.transaction((tx) =>
    updateAccountProfile(tx, "manager", "manager-session", {
      name: "مدیر اصلی",
      phone: "09123456789",
      ...input,
    }),
  );
async function signIn(email: string, password: string) {
  return httpAuth.handler(
    new Request("http://localhost:3300/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        origin: "http://localhost:3300",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }),
  );
}
describe("direct building account roles", () => {
  it("attaches a phone to an email account while granting manager access", async () => {
    await resident(true);
    await db
      .update(s.user)
      .set({ phone: null, email: "resident@test.local" })
      .where(eq(s.user.id, "resident"));
    await db.transaction((tx) =>
      changeBuildingRole(
        tx,
        "manager",
        "resident-member",
        "manager",
        "one",
        undefined,
        "+۹۸۹۱۲۳۴۵۶۷۸۹",
      ),
    );
    expect(
      await db.query.user.findFirst({ where: eq(s.user.phone, "09123456789") }),
    ).toMatchObject({ id: "resident", email: "resident@test.local" });
    expect(
      (await signIn("resident@test.local", "Resident-test-1405!")).status,
    ).toBe(200);
    await expect(
      db.transaction((tx) =>
        changeBuildingRole(
          tx,
          "manager",
          "manager-member",
          "manager",
          null,
          undefined,
          "09123456789",
        ),
      ),
    ).rejects.toThrow("حساب دیگری");
  });
  it("creates a manager with ordinary password login and no activation flow", async () => {
    const id = await add();
    const result = await signIn(
      "09123456789@residents.internal",
      "Resident-test-1405!",
    );
    expect(result.status).toBe(200);
    expect((await result.json()).user.id).toBe(id);
    expect(
      await db.query.membership.findFirst({
        where: eq(s.membership.userId, id),
      }),
    ).toMatchObject({ role: "manager", buildingId: "building" });
  });
  it("keeps the resident shell registration path available", async () => {
    const id = await add({
      role: "resident",
      unitId: "one",
      passwordHash: undefined,
    });
    expect(
      await db.query.membership.findFirst({
        where: eq(s.membership.userId, id),
      }),
    ).toMatchObject({ role: "resident", unitId: "one" });
    expect(
      await db.query.account.findFirst({ where: eq(s.account.userId, id) }),
    ).toBeUndefined();
  });
  it("promotes an existing active number without a duplicate user or password reset", async () => {
    await resident(true);
    expect(await add({ passwordHash: managerHash })).toBe("resident");
    expect(await db.select().from(s.user)).toHaveLength(2);
    expect(
      await db.query.account.findFirst({
        where: eq(s.account.id, "resident-credential"),
      }),
    ).toMatchObject({ password: otherHash });
    expect(
      await db.query.membership.findFirst({
        where: eq(s.membership.id, "resident-member"),
      }),
    ).toMatchObject({ role: "manager", unitId: "one" });
    expect(
      (await signIn("09123456789@residents.internal", "Resident-test-1405!"))
        .status,
    ).toBe(200);
  });
  it("requires a password before granting an unused shell administrator access", async () => {
    await expect(add({ passwordHash: undefined })).rejects.toThrow("رمز");
    expect(await db.select().from(s.user)).toHaveLength(1);
    await resident();
    await expect(change("resident-member", "manager")).rejects.toThrow("رمز");
    expect(
      await db.query.membership.findFirst({
        where: eq(s.membership.id, "resident-member"),
      }),
    ).toMatchObject({ role: "resident" });
    await change("resident-member", "manager", "one", otherHash);
    expect(
      (await signIn("09123456789@residents.internal", "Resident-test-1405!"))
        .status,
    ).toBe(200);
  });
  it("demotes another manager immediately and revokes their sessions", async () => {
    await resident(true, "building", "manager");
    await change("resident-member", "resident");
    expect(
      await db.query.session.findFirst({
        where: eq(s.session.userId, "resident"),
      }),
    ).toBeUndefined();
    expect(
      await db.query.account.findFirst({
        where: eq(s.account.userId, "resident"),
      }),
    ).toBeDefined();
    expect(
      await db.query.membership.findFirst({
        where: eq(s.membership.userId, "resident"),
      }),
    ).toMatchObject({ role: "resident", unitId: "one" });
  });
  it("protects the last manager and the current manager's own access", async () => {
    await expect(change("manager-member", "resident")).rejects.toThrow(
      "آخرین مدیر",
    );
    await resident(true, "building", "manager");
    await expect(change("manager-member", "resident")).rejects.toThrow(
      "خودتان",
    );
  });
  it("denies foreign buildings, invalid roles and resident actors", async () => {
    await resident(true, "foreign");
    await expect(change("resident-member", "manager")).rejects.toThrow(
      "پیدا نشد",
    );
    await expect(add()).rejects.toThrow("ساختمان دیگری");
    await expect(
      change("manager-member", "manager", null, undefined, "resident"),
    ).rejects.toThrow("دسترسی");
    await expect(add({ role: "superadmin" as "manager" })).rejects.toThrow(
      "معتبر",
    );
    await expect(
      add({ phone: "09121111111", unitId: "foreign-unit" }),
    ).rejects.toThrow("واحد");
  });
  it("sets another account's password without deleting Google or financial identity", async () => {
    await resident(true);
    await db.insert(s.account).values({
      id: "resident-google",
      userId: "resident",
      providerId: "google",
      accountId: "google-sub",
      createdAt: now(),
      updatedAt: now(),
    });
    await db.transaction((tx) =>
      setManagedPassword(tx, "manager", "resident-member", managerHash),
    );
    expect(
      await db.query.account.findFirst({
        where: eq(s.account.id, "resident-google"),
      }),
    ).toBeDefined();
    expect(
      await db.query.session.findFirst({
        where: eq(s.session.userId, "resident"),
      }),
    ).toBeUndefined();
    expect(
      (await signIn("09123456789@residents.internal", "Manager-test-1405!"))
        .status,
    ).toBe(200);
    await expect(
      db.transaction((tx) =>
        setManagedPassword(tx, "manager", "manager-member", otherHash),
      ),
    ).rejects.toThrow("خودتان");
  });
  it("does not silently demote a manager from the add-account form", async () => {
    await resident(true, "building", "manager");
    await expect(add({ role: "resident", unitId: "one" })).rejects.toThrow(
      "نقش و دسترسی",
    );
  });
});
describe("one identity for email and mobile", () => {
  it("saves the normalized phone without a password prompt or changing the email identity", async () => {
    await profile({ phone: "+۹۸۹۱۲۳۴۵۶۷۸۹" });
    expect(
      await db.query.user.findFirst({ where: eq(s.user.id, "manager") }),
    ).toMatchObject({ phone: "09123456789", email: "manager@test.local" });
    expect(
      (await signIn("manager@test.local", "Manager-test-1405!")).status,
    ).toBe(200);
  });
  it("connects an unused shell and preserves all historical references", async () => {
    await resident();
    await db.insert(s.paymentRequest).values({
      id: "request",
      userId: "resident",
      unitId: "one",
      amountRial: 1000,
    });
    await db.insert(s.chatMessage).values({
      id: "chat",
      userId: "resident",
      buildingId: "building",
      body: "سابقه",
    });
    await db.insert(s.maintenanceTicket).values({
      id: "ticket",
      createdBy: "resident",
      buildingId: "building",
      title: "درخواست",
    });
    await db.insert(s.payment).values({
      id: "receipt",
      buildingId: "building",
      unitId: "one",
      amountRial: 1000,
      method: "cash",
      paidAt: now(),
      recordedByUserId: "resident",
    });
    await db.insert(s.expenseCategory).values({
      id: "category",
      buildingId: "building",
      name: "نظافت",
      slug: "cleaning",
      allocationMethod: "per_unit",
    });
    await db.insert(s.standaloneExpense).values({
      id: "cost",
      buildingId: "building",
      categoryId: "category",
      amountRial: 1000,
      description: "هزینه",
      expenseDate: now(),
    });
    await db.insert(s.expenseDisbursement).values({
      id: "outlay",
      buildingId: "building",
      standaloneExpenseId: "cost",
      amountRial: 1000,
      payee: "فروشنده",
      paidAt: now(),
      method: "cash",
      recordedByUserId: "resident",
    });
    await profile();
    expect(
      await db.query.user.findFirst({ where: eq(s.user.id, "resident") }),
    ).toBeUndefined();
    expect(await db.query.membership.findFirst()).toMatchObject({
      userId: "manager",
      role: "manager",
      unitId: "one",
    });
    expect(await db.query.paymentRequest.findFirst()).toMatchObject({
      id: "request",
      userId: "manager",
    });
    expect(await db.query.payment.findFirst()).toMatchObject({
      id: "receipt",
      amountRial: 1000,
      recordedByUserId: "manager",
    });
    expect(await db.query.expenseDisbursement.findFirst()).toMatchObject({
      id: "outlay",
      amountRial: 1000,
      recordedByUserId: "manager",
    });
    expect(await db.query.chatMessage.findFirst()).toMatchObject({
      userId: "manager",
      body: "سابقه",
    });
    expect(await db.query.maintenanceTicket.findFirst()).toMatchObject({
      createdBy: "manager",
    });
  });
  it("keeps active identities separate and grants management through the role control", async () => {
    await resident(true);
    await expect(profile()).rejects.toThrow("حساب فعال جدا");
    expect(await db.select().from(s.user)).toHaveLength(2);
    await change("resident-member", "manager");
    const person = await db.query.user.findFirst({
      where: eq(s.user.phone, "09123456789"),
    });
    expect(person?.id).toBe("resident");
    expect((await signIn(person!.email, "Resident-test-1405!")).status).toBe(
      200,
    );
    expect(
      await db.query.membership.findFirst({
        where: eq(s.membership.userId, person!.id),
      }),
    ).toMatchObject({ role: "manager" });
    const logs = await db.select().from(s.managementEvent);
    expect(JSON.stringify(logs)).not.toContain(managerHash);
    expect(JSON.stringify(logs)).not.toContain("Manager-test-1405!");
  });
  it("does not merge someone else's building, another manager, or a different unit", async () => {
    await resident(true, "foreign");
    await expect(profile()).rejects.toThrow("حساب دیگری");
    await db
      .update(s.membership)
      .set({ buildingId: "building", unitId: "one", role: "manager" })
      .where(eq(s.membership.id, "resident-member"));
    await expect(profile()).rejects.toThrow("حساب دیگری");
    await db
      .update(s.membership)
      .set({ role: "resident" })
      .where(eq(s.membership.id, "resident-member"));
    await db
      .update(s.membership)
      .set({ unitId: "two" })
      .where(eq(s.membership.id, "manager-member"));
    await expect(profile()).rejects.toThrow("حساب دیگری");
  });
  it("rejects expired sessions but allows a signed-in Google account to save its phone", async () => {
    await db
      .update(s.session)
      .set({ expiresAt: new Date(0) })
      .where(eq(s.session.id, "manager-session"));
    await expect(profile()).rejects.toThrow("دوباره وارد");
    await db
      .update(s.session)
      .set({
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(Date.now() - 3600000),
      })
      .where(eq(s.session.id, "manager-session"));
    await db.delete(s.account).where(eq(s.account.userId, "manager"));
    await expect(profile()).resolves.toBe("building");
  });
  it("replaces the own password without an old-password field and retains this login", async () => {
    await db.transaction((tx) =>
      setOwnAccountPassword(tx, "manager", "manager-session", otherHash),
    );
    expect(
      (await signIn("manager@test.local", "Resident-test-1405!")).status,
    ).toBe(200);
    expect(
      (await signIn("manager@test.local", "Manager-test-1405!")).status,
    ).toBe(401);
    expect(
      await db.query.session.findFirst({
        where: eq(s.session.id, "manager-session"),
      }),
    ).toBeDefined();
    expect(
      JSON.stringify(await db.select().from(s.managementEvent)),
    ).not.toContain(otherHash);
  });
});

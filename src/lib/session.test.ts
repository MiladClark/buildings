import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), members: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: mocks.members }) }),
    }),
  },
}));
import { requireManager, requireResident } from "./session";

beforeEach(() => {
  mocks.getSession.mockResolvedValue({
    user: { id: "self" },
    session: { id: "current" },
  });
  mocks.members.mockResolvedValue([]);
});

describe("resident access with a manager's own unit", () => {
  it.each(["resident", "manager"])(
    "opens the assigned unit for %s without changing the stored role",
    async (role) => {
      const member = {
        userId: "self",
        buildingId: "building",
        role,
        unitId: "own-unit",
      };
      mocks.members.mockResolvedValue([member]);
      expect(await requireResident()).toMatchObject({ member });
      expect(member.role).toBe(role);
    },
  );
  it("keeps manager access when viewing the resident panel", async () => {
    mocks.members.mockResolvedValue([
      { userId: "self", role: "manager", unitId: "own-unit" },
    ]);
    expect(await requireManager()).toMatchObject({
      member: { role: "manager" },
    });
  });
  it.each([
    { members: [] },
    { members: [{ role: "manager", unitId: null }] },
    { members: [{ role: "accountant", unitId: "unit" }] },
  ])(
    "rejects a membership without resident access: %j",
    async ({ members }) => {
      mocks.members.mockResolvedValue(members);
      await expect(requireResident()).rejects.toThrow("FORBIDDEN");
    },
  );
  it("does not give ordinary residents management access", async () => {
    mocks.members.mockResolvedValue([{ role: "resident", unitId: "own-unit" }]);
    await expect(requireManager()).rejects.toThrow("FORBIDDEN");
  });
  it("requires authentication", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireResident()).rejects.toThrow("UNAUTHORIZED");
  });
});

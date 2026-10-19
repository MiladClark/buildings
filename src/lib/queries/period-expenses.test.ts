import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  member: vi.fn(),
  finance: vi.fn(),
  plan: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  getSession: mocks.session,
  getMembershipForUser: mocks.member,
}));
vi.mock("./finance", () => ({ getFinanceData: mocks.finance }));
vi.mock("@/lib/db", () => ({
  db: { query: { periodChargePlan: { findFirst: mocks.plan } } },
}));
import { getPeriodExpensesExportData } from "./period-expenses";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "manager" } });
  mocks.member.mockResolvedValue({ role: "manager", buildingId: "building" });
});

describe("period expense export authorization", () => {
  it.each([3000000, 0, null])(
    "reads this period's manual monthly amount %s",
    async (manualMonthlyRial) => {
      mocks.finance.mockResolvedValue({
        settings: { name: "ساختمان" },
        periods: [
          {
            id: "period",
            buildingId: "building",
            title: "مهر",
            startDate: new Date("2026-09-23"),
            endDate: new Date("2026-10-22"),
            status: "draft",
          },
        ],
        expenses: [],
      });
      mocks.plan.mockResolvedValue(
        manualMonthlyRial === null ? undefined : { manualMonthlyRial },
      );
      const result = await getPeriodExpensesExportData("period");
      expect(result).toMatchObject({
        ok: true,
        data: { manualMonthlyRial, totalRial: 0 },
      });
      expect(mocks.plan).toHaveBeenCalledOnce();
    },
  );
  it("rejects unauthenticated visitors before reading financial data", async () => {
    mocks.session.mockResolvedValue(null);
    expect(await getPeriodExpensesExportData("period")).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(mocks.finance).not.toHaveBeenCalled();
    expect(mocks.plan).not.toHaveBeenCalled();
  });
  it.each([null, { role: "resident", buildingId: "building" }])(
    "rejects non-manager membership %s",
    async (member) => {
      mocks.member.mockResolvedValue(member);
      expect(await getPeriodExpensesExportData("period")).toMatchObject({
        ok: false,
        status: 403,
      });
      expect(mocks.finance).not.toHaveBeenCalled();
    },
  );
  it.each([
    { periods: [] },
    { periods: [{ id: "period", buildingId: "foreign" }] },
    {
      periods: [
        { id: "period", buildingId: "building", deletedAt: new Date() },
      ],
    },
  ])(
    "does not export missing, foreign, or deleted periods",
    async ({ periods }) => {
      mocks.finance.mockResolvedValue({
        periods,
        settings: { name: "ساختمان" },
      });
      expect(await getPeriodExpensesExportData("period")).toMatchObject({
        ok: false,
        status: 404,
      });
      expect(mocks.finance).toHaveBeenCalledWith("building");
      expect(mocks.plan).not.toHaveBeenCalled();
    },
  );
});

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
  it("keeps common expenses visible in an issued fund report and uses the issued unit count", async () => {
    const date = new Date("2026-10-01");
    mocks.finance.mockResolvedValue({
      settings: { name: "ساختمان" },
      periods: [
        {
          id: "period",
          buildingId: "building",
          title: "مهر",
          startDate: new Date("2026-09-23"),
          endDate: new Date("2026-10-22"),
          status: "finalized",
          chargeModel: "fund",
        },
      ],
      invoices: [{ invoice: { id: "invoice", periodId: "period" } }],
      invoiceLines: [
        {
          invoiceId: "invoice",
          categoryId: "monthly-charge:building",
          basis: "مبلغ ثابت واحد",
          amountRial: 3500000,
        },
        {
          invoiceId: "invoice",
          categoryId: "water",
          basis: "نفرات",
          amountRial: 580000,
        },
      ],
      units: [],
      categories: [],
      settlement: { shares: [] },
      expenses: [
        {
          expense: {
            periodId: "period",
            amountRial: 1946000,
            expenseDate: date,
          },
          category: {
            id: "power",
            name: "برق",
            allocationMethod: "per_unit",
            slug: "common-electricity",
          },
        },
        {
          expense: {
            periodId: "period",
            amountRial: 580000,
            expenseDate: date,
          },
          category: {
            id: "water",
            name: "آب",
            allocationMethod: "per_person",
            slug: "water",
          },
        },
      ],
    });
    mocks.plan.mockResolvedValue({ manualMonthlyRial: 9000000 });
    const result = await getPeriodExpensesExportData("period");
    expect(result).toMatchObject({
      ok: true,
      data: {
        unitCount: 1,
        totalRial: 2526000,
        chargeTotalRial: 3500000,
        separateTotalRial: 580000,
        grandTotalRial: 4080000,
      },
    });
    if (result.ok) expect(result.data.items).toHaveLength(2);
  });
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
        invoices: [],
        invoiceLines: [],
        units: Array.from({ length: 8 }, (_, index) => ({
          id: `unit-${index}`,
          deletedAt: null,
        })),
        categories: [
          { id: "monthly-charge:building", allocationMethod: "fixed_per_unit" },
        ],
        settlement: {
          shares: Array.from({ length: 8 }, (_, index) => ({
            unitId: `unit-${index}`,
            periodId: "period",
            categoryId: "monthly-charge:building",
            amountRial: manualMonthlyRial ?? 0,
          })),
        },
      });
      mocks.plan.mockResolvedValue(
        manualMonthlyRial === null ? undefined : { manualMonthlyRial },
      );
      const result = await getPeriodExpensesExportData("period");
      expect(result).toMatchObject({
        ok: true,
        data: {
          manualMonthlyRial,
          totalRial: 0,
          chargeTotalRial: (manualMonthlyRial ?? 0) * 8,
          grandTotalRial: (manualMonthlyRial ?? 0) * 8,
        },
      });
      expect(mocks.plan).toHaveBeenCalledOnce();
    },
  );
  it("exports the billed snapshot even when the current plan or category rules changed", async () => {
    mocks.finance.mockResolvedValue({
      settings: { name: "ساختمان" },
      periods: [
        {
          id: "period",
          buildingId: "building",
          title: "مهر",
          startDate: new Date("2026-09-23"),
          endDate: new Date("2026-10-22"),
          status: "finalized",
        },
      ],
      invoices: [{ invoice: { id: "invoice", periodId: "period" } }],
      invoiceLines: [
        {
          invoiceId: "invoice",
          categoryId: "monthly-charge:building",
          basis: "مبلغ ثابت واحد",
          amountRial: 2000000,
        },
      ],
      units: [],
      categories: [
        { id: "monthly-charge:building", allocationMethod: "per_unit" },
      ],
      settlement: { shares: [] },
      expenses: [],
    });
    mocks.plan.mockResolvedValue({ manualMonthlyRial: 9000000 });
    expect(await getPeriodExpensesExportData("period")).toMatchObject({
      ok: true,
      data: {
        manualMonthlyRial: 2000000,
        chargeTotalRial: 2000000,
        grandTotalRial: 2000000,
        unitCount: 1,
      },
    });
  });
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

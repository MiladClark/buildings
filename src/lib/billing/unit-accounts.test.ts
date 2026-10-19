import { describe, expect, it } from "vitest";
import { unitAccountSummary, type AccountUnit } from "./unit-accounts";
import type { CostShare } from "./settlement-state";
const unit: AccountUnit = {
  id: "one",
  label: "۱",
  name: "ساکن",
  floor: 1,
  occupancy: "مسکونی",
  deleted: false,
};
const account = {
  unitId: "one",
  receivedRial: 700,
  debtRial: 100,
  creditRial: 200,
  reservedRial: 300,
  balanceRial: -100,
};
const share: CostShare = {
  unitId: "one",
  periodId: "period",
  categoryId: "water",
  title: "آب",
  periodTitle: "مهر",
  draft: false,
  amountRial: 200,
  paidRial: 100,
  balanceRial: 100,
};
describe("unit account cards", () => {
  it("separates draft balances from issued debt and never nets away a cost's unpaid amount", () => {
    const summary = unitAccountSummary(unit, account, [
      share,
      {
        ...share,
        draft: true,
        periodId: "draft",
        amountRial: 600,
        paidRial: 300,
        balanceRial: 300,
      },
      { ...share, unitId: "other", balanceRial: 9000 },
    ]);
    expect(summary).toMatchObject({
      unpaidRial: 400,
      draftBalanceRial: 300,
      outstandingCount: 2,
      state: "unpaid",
      stateLabel: "دارای مانده و اعتبار",
    });
    expect(summary.account.balanceRial).toBe(-100);
  });
  it("shows free credit even when there are no costs", () => {
    expect(unitAccountSummary(unit, account, [])).toMatchObject({
      state: "credit",
      unpaidRial: 0,
    });
  });
  it("handles a new unit without any account or costs", () => {
    expect(unitAccountSummary(unit, undefined, [])).toMatchObject({
      state: "empty",
      account: { creditRial: 0, receivedRial: 0 },
    });
  });
  it("marks paid or zero-share costs as settled while preserving deleted-unit history", () => {
    expect(
      unitAccountSummary({ ...unit, deleted: true }, undefined, [
        { ...share, balanceRial: 0 },
      ]),
    ).toMatchObject({ state: "settled", deleted: true, outstandingCount: 0 });
  });
});

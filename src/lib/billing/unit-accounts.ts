import type { CostShare } from "./settlement-state";

export type UnitAccount = {
  unitId: string;
  receivedRial: number;
  debtRial: number;
  creditRial: number;
  reservedRial: number;
  balanceRial: number;
};
export type AccountUnit = {
  id: string;
  label: string;
  name: string;
  floor: number | null;
  occupancy: string;
  deleted: boolean;
};

export function unitAccountSummary(
  unit: AccountUnit,
  account: UnitAccount | undefined,
  shares: CostShare[],
) {
  const costs = shares.filter((s) => s.unitId === unit.id);
  const draftBalanceRial = costs
    .filter((s) => s.draft)
    .reduce((sum, s) => sum + s.balanceRial, 0);
  const unpaidRial = costs.reduce((sum, s) => sum + s.balanceRial, 0);
  const creditRial = account?.creditRial ?? 0;
  const state =
    unpaidRial > 0
      ? "unpaid"
      : creditRial > 0
        ? "credit"
        : costs.length
          ? "settled"
          : "empty";
  return {
    ...unit,
    account: account ?? {
      unitId: unit.id,
      receivedRial: 0,
      debtRial: 0,
      creditRial: 0,
      reservedRial: 0,
      balanceRial: 0,
    },
    draftBalanceRial,
    unpaidRial,
    outstandingCount: costs.filter((s) => s.balanceRial > 0).length,
    state,
    stateLabel:
      unpaidRial > 0
        ? creditRial > 0
          ? "دارای مانده و اعتبار"
          : "مانده دارد"
        : creditRial > 0
          ? "بستانکار"
          : costs.length
            ? "تسویه‌شده"
            : "بدون هزینه",
  };
}

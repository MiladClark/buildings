import type * as schema from "@/lib/db/schema";
import { allocatePeriodCharges } from "./engine";
import { jalaliMonthSpan } from "@/lib/format/jalali";
import { periodChargeCategories } from "./monthly-charge";
import { receivableExpenses, usesChargeFund } from "./charge-model";

export type SettlementData = {
  units: (typeof schema.unit.$inferSelect)[];
  periods: (typeof schema.billingPeriod.$inferSelect)[];
  categories: (typeof schema.expenseCategory.$inferSelect)[];
  expenses: (typeof schema.expenseLine.$inferSelect)[];
  payments: (typeof schema.payment.$inferSelect)[];
  invoices: (typeof schema.unitInvoice.$inferSelect)[];
  lines: (typeof schema.invoiceLineItem.$inferSelect)[];
  applications: (typeof schema.paymentApplication.$inferSelect)[];
  settings: typeof schema.building.$inferSelect | undefined;
  standaloneExpenses?: (typeof schema.standaloneExpense.$inferSelect)[];
  chargePlans?: (typeof schema.periodChargePlan.$inferSelect)[];
};
export function isHeldPayment(
  payment: Pick<typeof schema.payment.$inferSelect, "standaloneExpenseId">,
  data: Pick<SettlementData, "standaloneExpenses">,
) {
  return (
    !!payment.standaloneExpenseId &&
    !data.standaloneExpenses?.some(
      (cost) =>
        cost.id === payment.standaloneExpenseId &&
        !!cost.linkedExpenseId &&
        !cost.deletedAt,
    )
  );
}
export type CostShare = {
  unitId: string;
  periodId: string;
  categoryId: string | null;
  title: string;
  periodTitle: string;
  draft: boolean;
  amountRial: number;
  paidRial: number;
  balanceRial: number;
};
export const scopeKey = (
  unitId: string,
  periodId: string,
  categoryId: string | null,
) => JSON.stringify([unitId, periodId, categoryId]);

export function buildSettlementState(data: SettlementData) {
  const shares: CostShare[] = [];
  const activeUnits = data.units.filter((u) => !u.deletedAt);
  const applied = new Map<string, number>();
  for (const a of data.applications) {
    const key = scopeKey(a.unitId, a.periodId, a.categoryId);
    applied.set(key, (applied.get(key) ?? 0) + a.amountRial);
  }
  function add(share: Omit<CostShare, "paidRial" | "balanceRial">, legacy = 0) {
    const key = scopeKey(share.unitId, share.periodId, share.categoryId);
    const paidRial = legacy + (applied.get(key) ?? 0);
    shares.push({
      ...share,
      paidRial,
      balanceRial: Math.max(0, share.amountRial - paidRial),
    });
  }
  for (const period of [...data.periods].sort(
    (a, b) =>
      a.startDate.getTime() - b.startDate.getTime() || a.id.localeCompare(b.id),
  )) {
    if (period.status === "draft") {
      const periodExpenses = data.expenses.filter(
        (e) => e.periodId === period.id,
      );
      const monthly = data.chargePlans?.find(
        (plan) => plan.periodId === period.id,
      )?.manualMonthlyRial;
      const expenses = receivableExpenses(
        data.categories,
        periodExpenses,
        usesChargeFund(period, monthly),
      );
      const categories = periodChargeCategories(
        data.categories,
        data.chargePlans?.find((plan) => plan.periodId === period.id)
          ?.manualMonthlyRial,
      ).filter(
        (c) =>
          c.allocationMethod !== "excluded" &&
          (expenses.some((e) => e.categoryId === c.id) ||
            (c.active &&
              c.allocationMethod === "fixed_per_unit" &&
              (c.fixedMonthlyAmount ?? 0) > 0)),
      );
      const preview = allocatePeriodCharges(
        activeUnits.map((u) => ({ ...u, unitId: u.id })),
        categories,
        expenses,
        {
          perUnitIncludeEmpty: data.settings?.perUnitIncludeEmpty ?? false,
          periodMonths: jalaliMonthSpan(period.startDate, period.endDate),
        },
      );
      for (const u of activeUnits)
        for (const c of categories)
          add({
            unitId: u.id,
            periodId: period.id,
            categoryId: c.id,
            title: c.name,
            periodTitle: period.title,
            draft: true,
            amountRial:
              preview.byUnit[u.id]?.lines
                .filter((l) => l.categoryId === c.id)
                .reduce((s, l) => s + l.amountRial, 0) ?? 0,
          });
    } else {
      for (const invoice of data.invoices.filter(
        (i) => i.periodId === period.id,
      )) {
        const lines = data.lines
          .filter((l) => l.invoiceId === invoice.id)
          .sort(
            (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
          );
        const groups = new Map<
          string | null,
          { title: string; amount: number; legacy: number }
        >();
        let legacy = invoice.legacyPaidRial;
        for (const l of lines) {
          const paid = Math.min(legacy, l.amountRial);
          legacy -= paid;
          const group = groups.get(l.categoryId) ?? {
            title: l.title,
            amount: 0,
            legacy: 0,
          };
          group.amount += l.amountRial;
          group.legacy += paid;
          groups.set(l.categoryId, group);
        }
        const missing =
          invoice.totalRial - lines.reduce((s, l) => s + l.amountRial, 0);
        if (missing > 0) {
          const group = groups.get(null) ?? {
            title: "سایر اقلام فیش",
            amount: 0,
            legacy: 0,
          };
          group.amount += missing;
          group.legacy += Math.min(legacy, missing);
          groups.set(null, group);
        }
        for (const [categoryId, group] of groups)
          add(
            {
              unitId: invoice.unitId,
              periodId: period.id,
              categoryId,
              title: group.title,
              periodTitle: period.title,
              draft: false,
              amountRial: group.amount,
            },
            group.legacy,
          );
      }
    }
  }
  const accounts = data.units.map((u) => {
    const payments = data.payments.filter((p) => p.unitId === u.id);
    const applications = data.applications.filter((a) => a.unitId === u.id);
    const legacyPaid = data.invoices
      .filter((i) => i.unitId === u.id)
      .reduce((s, i) => s + i.legacyPaidRial, 0);
    const receivedRial = payments.reduce((s, p) => s + p.amountRial, 0);
    const heldRial = payments
      .filter((p) => isHeldPayment(p, data))
      .reduce((s, p) => s + p.amountRial, 0);
    const creditRial = Math.max(
      0,
      receivedRial -
        heldRial -
        legacyPaid -
        applications.reduce((s, a) => s + a.amountRial, 0),
    );
    const debtRial = shares
      .filter((c) => c.unitId === u.id && !c.draft)
      .reduce((s, c) => s + c.balanceRial, 0);
    const reservedRial =
      heldRial +
      applications
        .filter(
          (a) =>
            data.periods.find((p) => p.id === a.periodId)?.status === "draft",
        )
        .reduce((s, a) => s + a.amountRial, 0);
    return {
      unitId: u.id,
      receivedRial,
      debtRial,
      creditRial,
      reservedRial,
      balanceRial: debtRial - creditRial,
    };
  });
  return { shares, accounts };
}

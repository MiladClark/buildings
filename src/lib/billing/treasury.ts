import type { expenseDisbursement } from "@/lib/db/schema";
import type { SettlementData } from "./settlement-state";

export type Disbursement = typeof expenseDisbursement.$inferSelect;
export type CostTarget = { expenseId?: string; standaloneExpenseId?: string };

/** One cost, even after an independent cost moves into or out of billing. */
export function buildTreasury(
  data: SettlementData,
  disbursements: Disbursement[],
) {
  const active = disbursements.filter((d) => !d.cancelledAt);
  const standalone = (data.standaloneExpenses ?? []).filter(
    (c) => !c.deletedAt,
  );
  const costs = [
    ...standalone.map((c) => ({
      key: `standalone:${c.id}`,
      target: { standaloneExpenseId: c.id } as CostTarget,
      title: c.description,
      categoryId: c.categoryId,
      estimateRial: c.amountRial,
      date: c.expenseDate.toISOString(),
      utilityBill: c.utilityBill ?? null,
      periodId:
        data.expenses.find((e) => e.id === c.linkedExpenseId)?.periodId ?? null,
      directRial: data.payments
        .filter((p) => p.kind === "advance" && p.standaloneExpenseId === c.id)
        .reduce((s, p) => s + p.amountRial, 0),
    })),
    ...data.expenses
      .filter(
        (e) =>
          !e.sourceStandaloneId &&
          !standalone.some((c) => c.linkedExpenseId === e.id),
      )
      .map((e) => ({
        key: `expense:${e.id}`,
        target: { expenseId: e.id } as CostTarget,
        title:
          e.description ||
          data.categories.find((c) => c.id === e.categoryId)?.name ||
          "هزینه ساختمان",
        categoryId: e.categoryId,
        estimateRial: e.amountRial,
        date: e.expenseDate.toISOString(),
        utilityBill: e.utilityBill ?? null,
        periodId: e.periodId,
        directRial: 0,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  // Older direct payments identify a category, not a line. Allocate once, in date order.
  for (const p of data.payments.filter(
    (p) => p.kind === "advance" && !p.standaloneExpenseId,
  )) {
    let remaining = p.amountRial;
    for (const c of costs.filter(
      (c) =>
        c.periodId === p.periodId &&
        (!p.categoryId || c.categoryId === p.categoryId),
    )) {
      const use = Math.min(
        remaining,
        Math.max(0, c.estimateRial - c.directRial),
      );
      c.directRial += use;
      remaining -= use;
    }
  }
  const rows = costs.map((c) => {
    const records = active.filter((d) =>
      c.target.standaloneExpenseId
        ? d.standaloneExpenseId === c.target.standaloneExpenseId
        : d.expenseId === c.target.expenseId,
    );
    const paidFromFundRial = records.reduce((s, d) => s + d.amountRial, 0);
    const paidRial = paidFromFundRial + c.directRial;
    const settled =
      records.some((d) => d.finalPayment) ||
      (c.directRial > 0 && paidRial >= c.estimateRial);
    return {
      ...c,
      category:
        data.categories.find((cat) => cat.id === c.categoryId)?.name ?? "—",
      periodTitle:
        data.periods.find((p) => p.id === c.periodId)?.title ??
        "مستقل؛ خارج از شارژ",
      paidFromFundRial,
      paidRial,
      settled,
      remainingRial: settled ? 0 : Math.max(0, c.estimateRial - paidRial),
      state: settled
        ? "پرداخت‌شده"
        : paidRial > 0
          ? "بخشی پرداخت‌شده"
          : "پرداخت‌نشده",
      actualRial: settled ? paidRial : null,
    };
  });
  const receivedRial = data.payments
    .filter((p) => p.kind === "receipt")
    .reduce((s, p) => s + p.amountRial, 0);
  const paidRial = active.reduce((s, d) => s + d.amountRial, 0);
  return {
    costs: rows.reverse(),
    receivedRial,
    paidRial,
    balanceRial: receivedRial - paidRial,
    pendingRial: rows.reduce((s, c) => s + c.remainingRial, 0),
    pendingCount: rows.filter((c) => !c.settled).length,
  };
}
export type Treasury = ReturnType<typeof buildTreasury>;

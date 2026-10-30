import type { FinanceData } from "./finance";

/** Both calendar surfaces use these events, built from the current ledger. */
export function buildingCalendarEvents(data: FinanceData) {
  return [
    ...(data.treasury?.costs ?? [])
      .filter((c) => c.utilityBill?.dueOn)
      .map((c) => ({
        id: `bill-due:${c.key}`,
        title: `مهلت قبض ${c.title}${c.settled ? " · پرداخت‌شده" : ""}`,
        date: new Date(`${c.utilityBill!.dueOn}T12:00:00Z`).toISOString(),
        href: "/manager/bills",
        kind: "due" as const,
        needsPayment: !c.settled && c.remainingRial > 0,
      })),
    ...data.maintenance
      .filter((t) => !t.deletedAt && t.scheduledAt && t.status !== "resolved")
      .map((t) => ({
        id: `maintenance:${t.id}`,
        title: t.title,
        date: t.scheduledAt!.toISOString(),
        href: `/manager/maintenance?ticket=${t.id}`,
        kind: "maintenance" as const,
        needsPayment: false,
      })),
    ...data.periods
      .filter((p) => p.dueDate)
      .map((p) => {
        const balance = data.invoices
          .filter((i) => i.invoice.periodId === p.id)
          .reduce((s, i) => s + i.invoice.balanceRial, 0);
        return {
          id: `period:${p.id}`,
          title: `${p.title}${p.status === "draft" ? " · پیش‌نویس" : balance === 0 ? " · تسویه‌شده" : ""}`,
          date: p.dueDate!.toISOString(),
          href: `/manager/periods/${p.id}`,
          kind: "due" as const,
          needsPayment: p.status !== "draft" && balance > 0,
        };
      }),
    ...data.expenses.map(({ expense: e, category: c }) => ({
      id: `expense:${e.id}`,
      title: e.description || c.name,
      date: e.expenseDate.toISOString(),
      href: `/manager/periods/${e.periodId}`,
      kind: "expense" as const,
      needsPayment: false,
    })),
    ...(data.standaloneExpenses ?? [])
      .filter((c) => !c.deletedAt && !c.linkedExpenseId)
      .map((c) => ({
        id: `standalone:${c.id}`,
        title: `${c.description} · مستقل`,
        date: c.expenseDate.toISOString(),
        href: `/manager/expenses/independent/${c.id}`,
        kind: "expense" as const,
        needsPayment: false,
      })),
    ...data.payments.map(({ payment: p, unit: u }) => ({
      id: `payment:${p.id}`,
      title: `${p.kind === "advance" ? "پرداخت مستقیم" : "واریز"} واحد ${u.label}`,
      date: p.paidAt.toISOString(),
      href: `/manager/payments?receipt=${p.id}`,
      kind: "payment" as const,
      needsPayment: false,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

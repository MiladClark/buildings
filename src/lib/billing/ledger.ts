/** Each invoice owns only its period's charges. Previous debt is informational. */
export function allocatePayment(
  amount: number,
  invoices: { id: string; totalRial: number; paidRial: number }[],
) {
  let remaining = amount;
  const updates: { id: string; paidRial: number; balanceRial: number }[] = [];
  for (const invoice of invoices) {
    const applied = Math.min(
      remaining,
      Math.max(0, invoice.totalRial - invoice.paidRial),
    );
    if (applied > 0)
      updates.push({
        id: invoice.id,
        paidRial: invoice.paidRial + applied,
        balanceRial: invoice.totalRial - invoice.paidRial - applied,
      });
    remaining -= applied;
  }
  return { updates, creditRial: remaining };
}

export function ledgerBalance(charges: number[], payments: number[]) {
  return (
    charges.reduce((a, b) => a + b, 0) - payments.reduce((a, b) => a + b, 0)
  );
}

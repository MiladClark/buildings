import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DATABASE_URL?.endsWith("/preview.db"))
    throw new Error("Only preview.db is allowed.");
  const { db } = await import("../src/lib/db");
  const s = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { loadSettlementData } =
    await import("../src/lib/billing/settlement-store");
  const { buildSettlementState } =
    await import("../src/lib/billing/settlement-state");
  const { finalizeBillingPeriod } = await import("../src/lib/billing/finalize");
  const period = await db.query.billingPeriod.findFirst({
    where: eq(s.billingPeriod.title, "آزمون تسویه نظافت"),
  });
  assert.ok(period);
  const before = await loadSettlementData(db, period.buildingId);
  const unit = before.units.find((u) => u.label === "1")!;
  const receipts = before.payments.filter(
    (p) => p.unitId === unit.id && p.periodId === period.id && p.categoryId,
  );
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].amountRial, 4_700_000);
  const originalCashCount = before.payments.length;
  let state = buildSettlementState(before);
  assert.equal(
    state.shares.find((c) => c.unitId === unit.id && c.periodId === period.id)!
      .paidRial,
    4_500_000,
  );
  assert.equal(
    state.accounts.find((a) => a.unitId === unit.id)!.creditRial,
    200_000,
  );
  for (const i of before.invoices.filter(
    (i) => i.unitId === unit.id && i.periodId !== period.id,
  ))
    assert.equal(
      i.paidRial,
      i.legacyPaidRial,
      "Old debt was not consumed by a cleaning payment",
    );
  if (process.argv.includes("--finalize") && period.status === "draft")
    await finalizeBillingPeriod(period.id);
  const after = await loadSettlementData(db, period.buildingId);
  state = buildSettlementState(after);
  assert.equal(after.payments.length, originalCashCount);
  for (const a of state.accounts)
    assert.equal(
      a.receivedRial,
      a.creditRial +
        a.reservedRial +
        after.invoices
          .filter((i) => i.unitId === a.unitId)
          .reduce((sum, i) => sum + i.paidRial, 0),
    );
  const account = state.accounts.find((a) => a.unitId === unit.id)!;
  assert.equal(account.creditRial, 200_000);
  if (after.periods.find((p) => p.id === period.id)!.status === "finalized") {
    const invoice = after.invoices.find(
      (i) => i.unitId === unit.id && i.periodId === period.id,
    )!;
    assert.equal(invoice.paidRial, 4_500_000);
    assert.equal(invoice.balanceRial, 0);
    assert.equal(account.reservedRial, 0);
  }
  console.log(
    "Verified: 470,000 toman receipt; 450,000 cleaning paid; 20,000 free credit; other debts unchanged; no duplicate cash on invoice issue; all account totals conserved.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
loadEnvConfig(process.cwd());
async function main() {
  assert.match(process.env.DATABASE_URL ?? "", /preview\.db$/);
  const { db } = await import("../src/lib/db");
  const { loadSettlementData } =
    await import("../src/lib/billing/settlement-store");
  const { buildSettlementState } =
    await import("../src/lib/billing/settlement-state");
  const b = await db.query.building.findFirst();
  const data = await loadSettlementData(db, b!.id);
  const state = buildSettlementState(data);
  for (const a of state.accounts) {
    const settled = data.invoices
      .filter((i) => i.unitId === a.unitId)
      .reduce((s, i) => s + i.paidRial, 0);
    assert.equal(a.receivedRial, a.creditRial + a.reservedRial + settled);
    assert.ok(a.creditRial >= 0 && a.reservedRial >= 0 && a.debtRial >= 0);
  }
  for (const receipt of data.payments.filter((p) => p.allocationTracked)) {
    const applied = data.applications
      .filter((a) => a.paymentId === receipt.id)
      .reduce((s, a) => s + a.amountRial, 0);
    assert.ok(applied <= receipt.amountRial);
  }
  for (const share of state.shares)
    assert.ok(share.paidRial <= share.amountRial);
  const receipts = data.payments.filter(
    (p) => p.note === "آزمون پرداخت نظافت و بیست هزار تومان اعتبار",
  );
  assert.equal(
    receipts.length,
    1,
    "No duplicate receipt after edit/void/restore",
  );
  assert.equal(receipts[0].amountRial, 4_700_000);
  const events = await db.query.managementEvent.findMany();
  assert.ok(
    events.some((e) => e.entityType === "payment" && e.action === "restore"),
  );
  assert.ok(
    events.some(
      (e) => e.entityType === "maintenance" && e.action === "restore",
    ),
  );
  console.log(
    `Verified cash conservation for ${state.accounts.length} units; receipt corrections and request recovery retain one cash record.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

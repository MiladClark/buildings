import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
loadEnvConfig(process.cwd());
async function main() {
  assert.match(process.env.DATABASE_URL ?? "", /preview\.db$/);
  const { db } = await import("../src/lib/db");
  const { getFinanceData, dashboardData } =
    await import("../src/lib/queries/finance");
  const { buildingCalendarEvents } =
    await import("../src/lib/queries/calendar");
  const building = await db.query.building.findFirst();
  const data = await getFinanceData(building!.id);
  const ticket = data.maintenance.find(
    (t) => t.title === "آزمون اصلاح چراغ پارکینگ",
  )!;
  assert.ok(ticket && ticket.scheduledAt);
  const costs = data.expenses.filter(
    (r) => r.expense.maintenanceTicketId === ticket.id,
  );
  assert.equal(costs.length, 1);
  assert.equal(costs[0].expense.amountRial, 9_000_000);
  const receipts = data.payments.filter(
    (r) => r.payment.note === "آزمون اتصال تعمیر به هزینه و دریافت",
  );
  assert.equal(receipts.length, 1);
  const receipt = receipts[0].payment;
  assert.equal(receipt.amountRial, 1_200_000);
  assert.equal(receipt.categoryId, costs[0].expense.categoryId);
  assert.equal(receipt.periodId, costs[0].expense.periodId);
  assert.equal(
    data.applications
      .filter((a) => a.paymentId === receipt.id)
      .reduce((s, a) => s + a.amountRial, 0),
    1_125_000,
  );
  for (const a of data.settlement.accounts) {
    const settled = data.invoices
      .filter((i) => i.invoice.unitId === a.unitId)
      .reduce((s, i) => s + i.invoice.paidRial, 0);
    assert.equal(a.receivedRial, settled + a.creditRial + a.reservedRial);
  }
  const events = buildingCalendarEvents(data);
  assert.deepEqual(dashboardData(data).calendarEvents, events);
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
  assert.ok(
    events.some((e) => e.href === `/manager/maintenance?ticket=${ticket.id}`),
  );
  assert.ok(
    events.some((e) => e.href === `/manager/payments?receipt=${receipt.id}`),
  );
  console.log(
    "Verified maintenance → expense → unit share → receipt, exact overpayment credit, both calendars and all unit cash balances.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

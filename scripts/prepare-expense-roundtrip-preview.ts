/** Disposable fixtures for the expense UI audit. Refuses every non-preview DB. */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (
    url.pathname !== "/vahedban_preview" ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error("Only the local vahedban_preview database is allowed.");
  const { db } = await import("../src/lib/db");
  const s = await import("../src/lib/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const { saveStandaloneCost, includeStandaloneCost } =
    await import("../src/lib/billing/standalone-expenses");
  const { insertUnitPayment } =
    await import("../src/lib/billing/settlement-store");
  const { recordDisbursement } =
    await import("../src/lib/billing/disbursements");
  const building = await db.query.building.findFirst();
  if (!building) throw new Error("Seed the preview first.");
  if (
    await db.query.expenseLine.findFirst({
      where: eq(s.expenseLine.description, "تجهیزات و لوازم — آزمون"),
    })
  )
    return;
  const period = await db.query.billingPeriod.findFirst({
    where: and(
      eq(s.billingPeriod.buildingId, building.id),
      eq(s.billingPeriod.status, "draft"),
    ),
  });
  const category = await db.query.expenseCategory.findFirst({
    where: and(
      eq(s.expenseCategory.buildingId, building.id),
      eq(s.expenseCategory.allocationMethod, "per_unit"),
    ),
  });
  const units = await db
    .select()
    .from(s.unit)
    .where(eq(s.unit.buildingId, building.id));
  if (!period || !category || units.length < 2)
    throw new Error("Expected the standard preview fixture.");
  await db.transaction(async (tx) => {
    const source = await saveStandaloneCost(tx, building.id, {
      categoryId: category.id,
      amountRial: 17_000_000,
      description: "نظافتچی — آزمون",
      expenseDate: new Date(),
    });
    for (const unit of units.slice(0, 2))
      await insertUnitPayment(
        tx,
        {
          unitId: unit.id,
          standaloneExpenseId: source,
          amountRial: 8_500_000,
          method: "bank_transfer",
          paidAt: new Date(),
        },
        building.id,
      );
    await recordDisbursement(tx, building.id, {
      id: crypto.randomUUID(),
      standaloneExpenseId: source,
      amountRial: 17_000_000,
      payee: "نظافتچی آزمایشی",
      paidAt: new Date(),
      method: "bank_transfer",
      items: [],
      finalPayment: true,
    });
    await includeStandaloneCost(tx, building.id, source, period.id);
    const id = crypto.randomUUID();
    await tx
      .insert(s.expenseLine)
      .values({
        id,
        periodId: period.id,
        categoryId: category.id,
        amountRial: 19_000_000,
        description: "تجهیزات و لوازم — آزمون",
        expenseDate: new Date(),
      });
    await recordDisbursement(tx, building.id, {
      id: crypto.randomUUID(),
      expenseId: id,
      amountRial: 14_644_000,
      payee: "فروشنده آزمایشی",
      paidAt: new Date(),
      method: "cash",
      items: [],
      finalPayment: true,
    });
  });
  console.log(
    "Two paid expense round-trip fixtures are ready in the local preview.",
  );
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

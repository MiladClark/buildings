import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DATABASE_URL?.endsWith("/vahedban_preview"))
    throw new Error("Only the separate vahedban_preview PostgreSQL database is allowed.");
  const { db } = await import("../src/lib/db");
  const s = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { fromJalali } = await import("../src/lib/format/jalali");
  const b = await db.query.building.findFirst();
  if (!b) throw new Error("Preview database missing.");
  const existing = await db.query.billingPeriod.findFirst({
    where: eq(s.billingPeriod.title, "آزمون تسویه نظافت"),
  });
  if (existing) {
    console.log("Cost payment preview already prepared.");
    return;
  }
  const categories = await db
    .select()
    .from(s.expenseCategory)
    .where(eq(s.expenseCategory.buildingId, b.id));
  const cleaning = categories.find(
    (c) => c.name.includes("نظافت") && c.allocationMethod === "per_unit",
  );
  if (!cleaning) throw new Error("Cleaning category missing.");
  await db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx
      .insert(s.billingPeriod)
      .values({
        id,
        buildingId: b.id,
        title: "آزمون تسویه نظافت",
        periodType: "monthly",
        startDate: fromJalali(1405, 8, 1),
        endDate: fromJalali(1405, 8, 30),
        dueDate: fromJalali(1405, 9, 10),
      });
    await tx
      .insert(s.expenseLine)
      .values({
        id: crypto.randomUUID(),
        periodId: id,
        categoryId: cleaning.id,
        amountRial: 36_000_000,
        description: "نظافت آزمایشی؛ سهم هر یک از هشت واحد ۴۵۰ هزار تومان",
        expenseDate: fromJalali(1405, 8, 1),
      });
  });
  console.log(
    "Preview prepared: 450,000 toman cleaning share per unit. No receipt recorded.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

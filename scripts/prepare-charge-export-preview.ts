import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
loadEnvConfig(process.cwd());

async function main() {
  if (process.env.DATABASE_URL !== "file:./data/preview.db")
    throw new Error("Only the isolated preview database is allowed.");
  const { db } = await import("../src/lib/db");
  const s = await import("../src/lib/db/schema");
  const { ensureMonthlyChargeCategory } =
    await import("../src/lib/billing/monthly-charge");
  const { finalizeBillingPeriod } = await import("../src/lib/billing/finalize");
  const building = await db.query.building.findFirst();
  if (!building) throw new Error("Seed preview first.");
  await db
    .insert(s.expenseCategory)
    .values({
      id: "fund-preview-common",
      buildingId: building.id,
      name: "برق و نگهداری مشترک",
      slug: "fund-preview-common",
      allocationMethod: "per_unit",
      includeEmptyUnits: true,
    })
    .onConflictDoNothing();
  const category = await db.query.expenseCategory.findFirst({
    where: eq(s.expenseCategory.id, "fund-preview-common"),
  });
  const water = (
    await db.query.expenseCategory.findMany({
      where: eq(s.expenseCategory.buildingId, building.id),
    })
  ).find((c) => c.slug === "water");
  if (!category) throw new Error("No preview category.");
  const periodId = "charge-export-preview-v3";
  if (
    !(await db.query.billingPeriod.findFirst({
      where: eq(s.billingPeriod.id, periodId),
    }))
  ) {
    await db.transaction(async (tx) => {
      await tx.insert(s.billingPeriod).values({
        id: periodId,
        buildingId: building.id,
        title: "فیش آزمایشی شارژ",
        periodType: "monthly",
        startDate: new Date("2026-09-23"),
        endDate: new Date("2026-10-22"),
      });
      await ensureMonthlyChargeCategory(tx, building.id);
      await tx
        .insert(s.periodChargePlan)
        .values({ periodId, manualMonthlyRial: 3500000 });
      await tx.insert(s.expenseLine).values({
        id: "charge-export-preview-v3-cost",
        periodId,
        categoryId: category.id,
        amountRial: 19460000,
        expenseDate: new Date("2026-10-01"),
        description: "هزینه‌های مشترک ساختمان",
      });
    });
    if (water)
      await db.insert(s.expenseLine).values({
        id: "fund-preview-v3-water",
        periodId,
        categoryId: water.id,
        amountRial: 5800000,
        description: "آب ساختمان",
        expenseDate: new Date("2026-10-01"),
      });
    await finalizeBillingPeriod(periodId);
  }
  const allUnits = await db.query.unit.findMany({
    where: eq(s.unit.buildingId, building.id),
  });
  const occupied = allUnits.find(
    (u) =>
      !u.deletedAt &&
      !u.temporarilyAbsent &&
      u.status !== "empty" &&
      u.occupantCount > 0,
  )!;
  const invoices = await db.query.unitInvoice.findMany({
    where: eq(s.unitInvoice.periodId, periodId),
  });
  const invoice = invoices.find((i) => i.unitId === occupied.id)!;
  const absentInvoice = invoices.find(
    (i) => allUnits.find((u) => u.id === i.unitId)?.temporarilyAbsent,
  );
  const { insertUnitPayment } =
    await import("../src/lib/billing/settlement-store");
  await db.transaction((tx) =>
    insertUnitPayment(
      tx,
      {
        unitId: occupied.id,
        periodId,
        categoryId: `monthly-charge:${building.id}`,
        amountRial: 2000000,
        method: "bank_transfer",
        paidAt: new Date("2026-10-20"),
        receiptKey: `detailed-preview-receipt:${periodId}`,
      },
      building.id,
    ),
  );
  const longPeriodId = "charge-export-long-preview-v3";
  if (
    !(await db.query.billingPeriod.findFirst({
      where: eq(s.billingPeriod.id, longPeriodId),
    }))
  ) {
    await db.transaction(async (tx) => {
      await tx.insert(s.billingPeriod).values({
        id: longPeriodId,
        buildingId: building.id,
        title: "ریز هزینه‌های آزمایشی چندصفحه‌ای",
        periodType: "monthly",
        startDate: new Date("2026-10-23"),
        endDate: new Date("2026-11-21"),
      });
      await tx
        .insert(s.periodChargePlan)
        .values({ periodId: longPeriodId, manualMonthlyRial: 3500000 });
      await tx.insert(s.expenseLine).values(
        Array.from({ length: 32 }, (_, index) => ({
          id: `charge-long-v3-cost-${index}`,
          periodId: longPeriodId,
          categoryId: category.id,
          amountRial: 1500000,
          expenseDate: new Date("2026-11-01"),
          description: `هزینه نگهداری بخش ${index + 1} ساختمان`,
        })),
      );
    });
  }
  const longPeriod = await db.query.billingPeriod.findFirst({
    where: eq(s.billingPeriod.id, longPeriodId),
  });
  if (longPeriod?.status === "draft") await finalizeBillingPeriod(longPeriodId);
  const longInvoice = (
    await db.query.unitInvoice.findMany({
      where: eq(s.unitInvoice.periodId, longPeriodId),
    })
  ).find((i) => i.unitId === occupied.id);
  await mkdir("tmp/pdfs", { recursive: true });
  await writeFile(
    "tmp/pdfs/preview-ids.json",
    JSON.stringify({
      periodId,
      invoiceId: invoice?.id,
      absentInvoiceId: absentInvoice?.id,
      longPeriodId,
      longInvoiceId: longInvoice?.id,
    }),
  );
  console.log("Synthetic preview invoice ready.");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

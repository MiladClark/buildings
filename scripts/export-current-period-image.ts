import { loadEnvConfig } from "@next/env";
import { writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
loadEnvConfig(process.cwd());
async function main() {
  const { db } = await import("../src/lib/db");
  const { periodChargePlan } = await import("../src/lib/db/schema");
  const { getFinanceData } = await import("../src/lib/queries/finance");
  const { financePeriodExpensesReport } =
    await import("../src/lib/export/finance-period-expenses");
  const { renderPeriodExpensesImage } =
    await import("../src/lib/export/period-expenses-image");
  const { datedExportFilename } = await import("../src/lib/export/filenames");
  const id = process.argv[2];
  if (!id) throw new Error("Pass the period id.");
  const period = await db.query.billingPeriod.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });
  if (!period || period.deletedAt) throw new Error("Period not found.");
  const data = await getFinanceData(period.buildingId);
  const plan = await db.query.periodChargePlan.findFirst({
    where: eq(periodChargePlan.periodId, id),
  });
  const report = financePeriodExpensesReport(
    data,
    period,
    plan?.manualMonthlyRial,
  );
  await writeFile(
    `output/pdf/${datedExportFilename("ریز-هزینه‌ها", "png")}`,
    await renderPeriodExpensesImage(report),
  );
  console.log(
    JSON.stringify({
      monthlyToman: report.manualMonthlyRial! / 10,
      expensesToman: report.totalRial / 10,
      payableToman: report.grandTotalRial / 10,
    }),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

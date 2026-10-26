import { loadEnvConfig } from "@next/env";
import { mkdir } from "node:fs/promises";
import path from "node:path";
loadEnvConfig(process.cwd());

async function main() {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("../src/lib/db/schema");
  const url = process.env.DATABASE_URL ?? "file:./data/buildings.db";
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  const { ensureMonthlyChargeCategory, monthlyChargeCategoryId } =
    await import("../src/lib/billing/monthly-charge");
  const plans = await db.query.periodChargePlan.findMany();
  const periods = await db.query.billingPeriod.findMany();
  const categories = await db.query.expenseCategory.findMany();
  const ids = [
    ...new Set(
      plans
        .filter((p) => (p.manualMonthlyRial ?? 0) > 0)
        .map(
          (p) => periods.find((period) => period.id === p.periodId)?.buildingId,
        )
        .filter((id): id is string => !!id),
    ),
  ].filter(
    (id) => !categories.some((c) => c.id === monthlyChargeCategoryId(id)),
  );
  if (!ids.length) {
    console.log("Monthly charge categories already ready.");
    client.close();
    return;
  }
  if (url.startsWith("file:")) {
    await mkdir("data/backups", { recursive: true });
    const backup = path.resolve(
      `data/backups/before-monthly-charge-${Date.now()}.db`,
    );
    await client.execute(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
  }
  await db.transaction(async (tx) => {
    for (const id of ids) await ensureMonthlyChargeCategory(tx, id);
  });
  console.log(
    `Monthly charge ready for ${ids.length} building(s); issued invoices and payment records unchanged.`,
  );
  client.close();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

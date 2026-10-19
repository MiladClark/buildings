import { loadEnvConfig } from "@next/env";
import { createClient } from "@libsql/client";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
loadEnvConfig(process.cwd());

async function main() {
  const url =
    process.argv[2] ?? process.env.DATABASE_URL ?? "file:./data/buildings.db";
  const client = createClient({ url });
  try {
    const columns = await client.execute("PRAGMA table_info(expense_line)");
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    const hasCoverage = columns.rows.some((c) => c.name === "coverage_months");
    if (
      hasCoverage &&
      ["charge_budget_policy", "period_charge_plan"].every((name) =>
        tables.rows.some((r) => r.name === name),
      )
    ) {
      console.log("Charge planning migration already applied.");
      return;
    }
    if (url.startsWith("file:")) {
      await mkdir("data/backups", { recursive: true });
      const backup = path.resolve(
        "data/backups",
        `before-charge-planning-${Date.now()}.db`,
      );
      await client.execute(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
      console.log("Consistent database backup saved.");
    }
    const queries = [];
    for (const table of [
      "unit",
      "billing_period",
      "expense_line",
      "unit_invoice",
      "invoice_line_item",
      "payment",
      "payment_application",
    ]) {
      const info = await client.execute(`PRAGMA table_info(${table})`);
      queries.push(
        `SELECT ${info.rows.map((c) => `"${String(c.name).replaceAll('"', '""')}"`).join(",")} FROM ${table} ORDER BY id`,
      );
    }
    const tx = await client.transaction("write");
    try {
      const before = [];
      for (const query of queries)
        before.push(JSON.stringify((await tx.execute(query)).rows));
      const sql = await readFile(
        "drizzle/0006_complete_kitty_pryde.sql",
        "utf8",
      );
      for (const statement of sql.split("--> statement-breakpoint")) {
        if (
          !statement.trim() ||
          (hasCoverage && statement.includes("ALTER TABLE"))
        )
          continue;
        await tx.execute(
          statement.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS "),
        );
      }
      for (const [i, query] of queries.entries())
        if (before[i] !== JSON.stringify((await tx.execute(query)).rows))
          throw new Error(
            "Existing financial records changed; migration rolled back.",
          );
      await tx.commit();
      console.log(
        "Charge planning ready. All existing financial records preserved exactly.",
      );
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  } finally {
    client.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

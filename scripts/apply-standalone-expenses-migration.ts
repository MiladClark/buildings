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
    const payments = await client.execute("PRAGMA table_info(payment)");
    const expenses = await client.execute("PRAGMA table_info(expense_line)");
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    const columns = new Set(payments.rows.map((c) => String(c.name)));
    const sourceExists = expenses.rows.some(
      (c) => c.name === "source_standalone_id",
    );
    if (
      columns.has("standalone_expense_id") &&
      columns.has("kind") &&
      sourceExists &&
      tables.rows.some((r) => r.name === "standalone_expense")
    ) {
      console.log("Independent expense migration already applied.");
      return;
    }
    if (url.startsWith("file:")) {
      await mkdir("data/backups", { recursive: true });
      const backup = path.resolve(
        "data/backups",
        `before-independent-expenses-${Date.now()}.db`,
      );
      await client.execute(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
      console.log("Consistent backup saved before migration.");
    }
    const queries: string[] = [];
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
      for (const name of ["0008_normal_risque", "0009_wandering_taskmaster"]) {
        const sql = await readFile(`drizzle/${name}.sql`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint")) {
          if (!statement.trim()) continue;
          if (
            statement.includes(
              "ALTER TABLE `payment` ADD `standalone_expense_id`",
            ) &&
            columns.has("standalone_expense_id")
          )
            continue;
          if (
            statement.includes("ALTER TABLE `payment` ADD `kind`") &&
            columns.has("kind")
          )
            continue;
          if (statement.includes("ALTER TABLE `expense_line`") && sourceExists)
            continue;
          await tx.execute(
            statement
              .replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
              .replace(
                "CREATE UNIQUE INDEX ",
                "CREATE UNIQUE INDEX IF NOT EXISTS ",
              ),
          );
        }
      }
      for (const [i, query] of queries.entries())
        if (before[i] !== JSON.stringify((await tx.execute(query)).rows))
          throw new Error(
            "Existing financial records changed; migration rolled back.",
          );
      await tx.commit();
      console.log(
        "Independent expenses ready; all existing financial records preserved exactly.",
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

import { loadEnvConfig } from "@next/env";
import { createClient } from "@libsql/client";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
loadEnvConfig(process.cwd());
async function main() {
  const url =
    process.argv[2] ?? process.env.DATABASE_URL ?? "file:./data/buildings.db";
  const client = createClient({ url });
  try {
    const columns = await client.execute("PRAGMA table_info(unit_invoice)");
    if (columns.rows.some((r) => r.name === "legacy_paid_rial")) {
      console.log("Payment ledger migration already applied.");
      return;
    }
    const invalid = await client.execute(
      "SELECT id FROM unit u WHERE COALESCE((SELECT SUM(paid_rial) FROM unit_invoice WHERE unit_id = u.id), 0) > COALESCE((SELECT SUM(amount_rial) FROM payment WHERE unit_id = u.id), 0)",
    );
    if (invalid.rows.length)
      throw new Error(
        "سوابق قبلی تسویه و دریافت سازگار نیستند؛ مهاجرت بدون تغییر داده متوقف شد.",
      );
    if (url.startsWith("file:")) {
      await mkdir("data/backups", { recursive: true });
      const backup = path.resolve(
        "data/backups",
        `before-cost-payments-${Date.now()}.db`,
      );
      await client.execute(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
      console.log("Consistent local database backup saved before upgrade.");
    }
    const sql = await readFile("drizzle/0002_dusty_chameleon.sql", "utf8");
    const verifySql =
      "SELECT (SELECT COUNT(*) FROM payment) AS receipts, (SELECT COALESCE(SUM(amount_rial),0) FROM payment) AS received, (SELECT COUNT(*) FROM unit_invoice) AS invoices, (SELECT COALESCE(SUM(total_rial),0) FROM unit_invoice) AS charged, (SELECT COALESCE(SUM(paid_rial),0) FROM unit_invoice) AS settled, (SELECT COALESCE(SUM(balance_rial),0) FROM unit_invoice) AS balance";
    const original = await client.execute(verifySql);
    const tx = await client.transaction("write");
    try {
      for (const statement of sql.split("--> statement-breakpoint"))
        if (statement.trim()) await tx.execute(statement);
      const upgraded = await tx.execute(verifySql);
      if (
        original.columns.some(
          (key) =>
            String(original.rows[0][key]) !== String(upgraded.rows[0][key]),
        )
      )
        throw new Error(
          "سوابق دریافت و فیش در مهاجرت تغییر کرده‌اند؛ تراکنش لغو شد.",
        );
      await tx.commit();
      console.log(
        "Cost payment ledger ready. Existing receipts and invoice settlements preserved.",
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

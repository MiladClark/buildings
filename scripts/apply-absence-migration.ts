import { loadEnvConfig } from "@next/env";
import { createClient } from "@libsql/client";

// For existing installations created with db:push (no migration journal).
// Only adds the two presence flags; safe to run again, preserves financial data.
loadEnvConfig(process.cwd());
const client = createClient({
  url:
    process.argv[2] ?? process.env.DATABASE_URL ?? "file:./data/buildings.db",
});
async function main() {
  const tx = await client.transaction("write");
  try {
    let added = 0;
    for (const table of ["unit", "period_snapshot"] as const) {
      const info = await tx.execute(`PRAGMA table_info(${table})`);
      if (!info.rows.length)
        throw new Error(
          `Missing table: ${table}. Run db:migrate for a new database.`,
        );
      if (info.rows.some((r) => r.name === "temporarily_absent")) continue;
      await tx.execute(
        `ALTER TABLE ${table} ADD COLUMN temporarily_absent integer NOT NULL DEFAULT false`,
      );
      added++;
    }
    await tx.commit();
    console.log(
      `Presence migration complete: ${added} columns added. Existing records preserved.`,
    );
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
    client.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

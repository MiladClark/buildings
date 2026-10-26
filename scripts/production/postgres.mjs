import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { readMigrationFiles } from "drizzle-orm/migrator";

export const migrationFolder = "./drizzle/postgresql";
export const importOrder = [
  "building",
  "user",
  "account",
  "session",
  "verification",
  "unit",
  "membership",
  "expense_category",
  "billing_period",
  "period_snapshot",
  "maintenance_ticket",
  "expense_line",
  "charge_budget_policy",
  "period_charge_plan",
  "standalone_expense",
  "unit_invoice",
  "invoice_line_item",
  "payment",
  "payment_request",
  "payment_application",
  "app_notification",
  "chat_message",
  "charge_recommendation",
  "rate_adjustment",
  "management_event",
];

export function openPostgres() {
  const url = process.env.DATABASE_URL;
  if (!/^postgres(?:ql)?:\/\//.test(url ?? ""))
    throw new Error("DATABASE_URL must point to PostgreSQL.");
  return postgres(url, { max: 1, connect_timeout: 15 });
}

export async function schemaManifest() {
  const journal = JSON.parse(
    await readFile(`${migrationFolder}/meta/_journal.json`, "utf8"),
  );
  const index = String(journal.entries.at(-1).idx).padStart(4, "0");
  const snapshot = JSON.parse(
    await readFile(`${migrationFolder}/meta/${index}_snapshot.json`, "utf8"),
  );
  return Object.fromEntries(
    Object.values(snapshot.tables).map((table) => [table.name, table.columns]),
  );
}

export async function validateMigrationHistory(query) {
  const migrations = readMigrationFiles({ migrationsFolder: migrationFolder });
  const result = await query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') AS history",
  );
  if (result[0].history) {
    const applied = await query(
      "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at",
    );
    for (const row of applied) {
      const known = migrations.find(
        (migration) => migration.folderMillis === Number(row.created_at),
      );
      if (!known || known.hash !== row.hash)
        throw new Error("Migration history differs from this release.");
    }
  } else {
    const tables = await query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    if (tables.length)
      throw new Error(
        "Unversioned existing database detected. Refusing to change it.",
      );
  }
}

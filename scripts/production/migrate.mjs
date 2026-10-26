import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { openDatabase, snapshot } from "./database.mjs";

const { client, filename } = await openDatabase();
try {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  const hasSchema = tables.rows.some(
    (row) => row.name !== "__drizzle_migrations",
  );
  let applied = [];
  if (tables.rows.some((row) => row.name === "__drizzle_migrations")) {
    applied = (
      await client.execute(
        "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at",
      )
    ).rows;
  }
  // A db:push database needs the documented legacy upgrade, not a blind replay.
  if (hasSchema && applied.length === 0) {
    throw new Error(
      "Unversioned existing database detected. Refusing automatic migration; follow the legacy upgrade guide.",
    );
  }
  const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
  for (const row of applied) {
    const known = migrations.find(
      (migration) => migration.folderMillis === Number(row.created_at),
    );
    if (!known || known.hash !== row.hash)
      throw new Error(
        "Migration history differs from this release. Refusing to start.",
      );
  }
  if (applied.length < migrations.length) {
    if (hasSchema)
      console.log(
        `Pre-migration backup: ${await snapshot(client, filename, "before-migration")}`,
      );
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  }
  await client.execute("PRAGMA journal_mode = WAL");
  const integrity = await client.execute("PRAGMA quick_check");
  if (integrity.rows[0]?.quick_check !== "ok")
    throw new Error("Database integrity check failed.");
  if ((await client.execute("PRAGMA foreign_key_check")).rows.length)
    throw new Error("Database foreign key check failed.");
  // A fresh installation has settings and categories, with no demo accounts or financial data.
  const tx = await client.transaction("write");
  try {
    if (!(await tx.execute("SELECT id FROM building LIMIT 1")).rows.length) {
      const id = crypto.randomUUID();
      await tx.execute({
        sql: "INSERT INTO building (id, name) VALUES (?, ?)",
        args: [id, "ساختمان من"],
      });
      const categories = [
        ["آب ساختمان", "water", "per_person"],
        ["برق مشترک", "common-electricity", "per_unit"],
        ["آسانسور", "elevator", "per_unit"],
        ["پارکینگ", "parking", "per_unit"],
        ["نظافت", "cleaning", "per_unit"],
        ["تجهیزات و لوازم", "equipment", "per_unit"],
        ["گاز (شخصی)", "gas", "excluded"],
      ];
      for (const [index, [name, slug, method]] of categories.entries()) {
        await tx.execute({
          sql: "INSERT INTO expense_category (id, building_id, name, slug, kind, allocation_method, include_empty_units, sort_order, active) VALUES (?, ?, ?, ?, 'variable', ?, 0, ?, ?)",
          args: [
            crypto.randomUUID(),
            id,
            name,
            slug,
            method,
            index,
            method === "excluded" ? 0 : 1,
          ],
        });
      }
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
  console.log(`Database ready (${migrations.length} migrations).`);
} finally {
  client.close();
}

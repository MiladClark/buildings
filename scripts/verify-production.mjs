import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
  canonicalRows,
  digest,
  importBundle,
} from "./production/import-bundle.mjs";
import {
  importOrder,
  schemaManifest,
  validateMigrationHistory,
  migrationFolder,
} from "./production/postgres.mjs";

const directory = await mkdtemp(path.join(tmpdir(), "vahedban-pg-check-"));
let client = new PGlite();
const query = async (sql, values = []) =>
  (await client.query(sql, values)).rows;
const adapter = {
  query,
  transaction: (fn) =>
    client.transaction((tx) =>
      fn(async (sql, values = []) => (await tx.query(sql, values)).rows),
    ),
};
const encode = (bundle) => gzipSync(JSON.stringify(bundle)).toString("base64");
try {
  await validateMigrationHistory(query);
  await migrate(drizzle(client), { migrationsFolder: migrationFolder });
  await validateMigrationHistory(query);
  await migrate(drizzle(client), { migrationsFolder: migrationFolder });
  const manifest = await schemaManifest();
  let encoded;
  if (process.argv[2]) {
    encoded = await readFile(process.argv[2], "utf8");
  } else {
    await query(
      "INSERT INTO building (id, name) VALUES ('building', 'Preserved building')",
    );
    await query(
      "INSERT INTO unit (id, building_id, label, sort_order) VALUES ('unit', 'building', '1', 1793000000000)",
    );
    await query(
      "INSERT INTO payment (id, building_id, unit_id, amount_rial, method, paid_at) VALUES ('receipt', 'building', 'unit', 3000000000, 'bank_transfer', '2026-10-26T12:00:00.123Z')",
    );
    const bundle = { version: 1, tables: {}, files: [] };
    for (const table of importOrder) {
      const rows = await query('SELECT * FROM "' + table + '"');
      for (const row of rows)
        for (const [name, column] of Object.entries(manifest[table])) {
          if (row[name] != null && column.type.startsWith("timestamp"))
            row[name] = new Date(row[name]).getTime();
          if (row[name] != null && column.type === "boolean")
            row[name] = Number(row[name]);
          if (row[name] != null && column.type === "bigint")
            row[name] = Number(row[name]);
        }
      bundle.tables[table] = {
        rows,
        sha256: digest(canonicalRows(rows, manifest[table])),
      };
    }
    encoded = encode(bundle);
  }
  await client.close();
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: migrationFolder });
  const broken = JSON.parse(
    (await import("node:zlib")).gunzipSync(Buffer.from(encoded, "base64")),
  );
  broken.tables.building.sha256 = "corrupt";
  await assert.rejects(
    importBundle(adapter, encode(broken), directory),
    /Data comparison failed/,
  );
  assert.equal(
    (await query("SELECT count(*) AS count FROM building"))[0].count,
    0,
  );
  await importBundle(adapter, encoded, directory);
  await importBundle(adapter, encoded, directory);
  if (!process.argv[2]) {
    assert.equal(
      Number((await query("SELECT amount_rial FROM payment"))[0].amount_rial),
      3000000000,
    );
    assert.equal(
      Number((await query('SELECT sort_order FROM "unit"'))[0].sort_order),
      1793000000000,
    );
  }
  await query("UPDATE drizzle.__drizzle_migrations SET hash = 'tampered'");
  await assert.rejects(
    validateMigrationHistory(query),
    /Migration history differs/,
  );
  await query("DROP SCHEMA drizzle CASCADE");
  await assert.rejects(
    validateMigrationHistory(query),
    /Unversioned existing database/,
  );
  console.log(
    "PostgreSQL deployment checks passed: migrations, full-row transfer checksums, rollback, repeated import, 64-bit amounts, and history protection.",
  );
} finally {
  await client.close();
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

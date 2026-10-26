import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { readMigrationFiles } from "drizzle-orm/migrator";

// Run database assertions in a child so Windows releases all native SQLite
// handles before the parent removes the temporary directory.
if (process.argv[2] !== "--worker") {
  const temporary = await mkdtemp(path.join(tmpdir(), "vahedban-deploy-"));
  let status = 1;
  try {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-production.mjs", "--worker", temporary],
      { stdio: "inherit" },
    );
    status = result.status ?? 1;
  } finally {
    await rm(temporary, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
  process.exit(status);
}
const directory = process.argv[3];
const filename = path.join(directory, "fresh.db");
const env = { ...process.env, DATABASE_URL: `file:${filename}` };
const migrate = () =>
  execFileSync(process.execPath, ["scripts/production/migrate.mjs"], {
    env,
    encoding: "utf8",
  });
let client;
try {
  migrate();
  client = createClient({ url: env.DATABASE_URL });
  for (const table of [
    "user",
    "unit",
    "payment",
    "unit_invoice",
    "billing_period",
  ]) {
    assert.equal(
      (await client.execute(`SELECT count(*) AS count FROM ${table}`)).rows[0]
        .count,
      0,
      `${table} must start empty`,
    );
  }
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM building")).rows[0]
      .count,
    1,
  );
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM expense_category"))
      .rows[0].count,
    7,
  );
  const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
  assert.equal(
    (await client.execute("SELECT count(*) AS count FROM __drizzle_migrations"))
      .rows[0].count,
    migrations.length,
  );
  await client.execute("UPDATE building SET name = 'Preserved building'");
  client.close();
  migrate();
  client = createClient({ url: env.DATABASE_URL });
  assert.equal(
    (await client.execute("SELECT name FROM building")).rows[0].name,
    "Preserved building",
  );
  client.close();
  execFileSync(process.execPath, ["scripts/production/backup.mjs"], { env });
  const backups = await readdir(path.join(directory, "backups"));
  assert.equal(backups.length, 1);
  client = createClient({
    url: `file:${path.join(directory, "backups", backups[0])}`,
  });
  assert.equal(
    (await client.execute("PRAGMA quick_check")).rows[0].quick_check,
    "ok",
  );
  assert.equal(
    (await client.execute("SELECT name FROM building")).rows[0].name,
    "Preserved building",
  );
  client.close();
  // Simulate a previous release, then verify the pending migration and automatic backup.
  client = createClient({ url: env.DATABASE_URL });
  await client.execute("DROP INDEX user_phone_unique");
  await client.execute("ALTER TABLE user DROP COLUMN phone");
  await client.execute({
    sql: "DELETE FROM __drizzle_migrations WHERE created_at = ?",
    args: [migrations.at(-1).folderMillis],
  });
  client.close();
  migrate();
  assert.equal(
    (await readdir(path.join(directory, "backups"))).filter((name) =>
      name.startsWith("before-migration-"),
    ).length,
    1,
  );
  client = createClient({ url: env.DATABASE_URL });
  assert.ok(
    (await client.execute("PRAGMA table_info(user)")).rows.some(
      (row) => row.name === "phone",
    ),
  );
  await client.execute(
    "UPDATE __drizzle_migrations SET hash = 'modified' WHERE created_at = (SELECT max(created_at) FROM __drizzle_migrations)",
  );
  client.close();
  const mismatch = spawnSync(
    process.execPath,
    ["scripts/production/migrate.mjs"],
    { env, encoding: "utf8" },
  );
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /Migration history differs/);
  client = createClient({ url: env.DATABASE_URL });
  await client.execute("DROP TABLE __drizzle_migrations");
  client.close();
  const legacy = spawnSync(
    process.execPath,
    ["scripts/production/migrate.mjs"],
    { env, encoding: "utf8" },
  );
  assert.notEqual(legacy.status, 0);
  assert.match(legacy.stderr, /Unversioned existing database/);
  console.log(
    "Production checks passed: clean install, idempotent restart, backup restore, upgrade backup, history validation, legacy protection.",
  );
} finally {
  client?.close();
}

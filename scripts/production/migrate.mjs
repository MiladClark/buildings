import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  openPostgres,
  validateMigrationHistory,
  migrationFolder,
} from "./postgres.mjs";
import { importBundle } from "./import-bundle.mjs";

const client = openPostgres();
try {
  try {
    // This client has exactly one connection, so the session lock also covers
    // the transaction that Drizzle opens while applying migrations.
    await client.unsafe("SELECT pg_advisory_lock(8662302)");
    await validateMigrationHistory((sql) => client.unsafe(sql));
    await migrate(drizzle(client), { migrationsFolder: migrationFolder });
  } finally {
    await client.unsafe("SELECT pg_advisory_unlock(8662302)");
  }
  if (process.env.INITIAL_IMPORT_BUNDLE) {
    await importBundle(
      {
        query: (sql, values = []) => client.unsafe(sql, values),
        transaction: (fn) =>
          client.begin((tx) =>
            fn((sql, values = []) => tx.unsafe(sql, values)),
          ),
      },
      process.env.INITIAL_IMPORT_BUNDLE,
      process.env.CHAT_UPLOAD_DIR ?? "/app/data/chat-uploads",
    );
  }
  console.log("PostgreSQL migrations ready.");
} finally {
  await client.end();
}

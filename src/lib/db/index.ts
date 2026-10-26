import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

import * as schema from "./schema";

const url =
  process.env.DATABASE_URL ??
  "postgresql://vahedban:vahedban@localhost:5432/vahedban";
if (!/^postgres(?:ql)?:\/\//.test(url))
  throw new Error(
    "DATABASE_URL must be a PostgreSQL connection URL. Use the SQLite transfer tool for existing local data.",
  );
const globalForDb = globalThis as unknown as {
  sqlClient?: ReturnType<typeof postgres>;
};
const client =
  globalForDb.sqlClient ??
  postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.sqlClient = client;

export const db = drizzle(client, { schema });
// Serialize ledger writes across PostgreSQL sessions, as in the original ledger.
const transact = db.transaction.bind(db);
db.transaction = (callback, config) =>
  transact(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(8662301)`);
    return callback(tx);
  }, config);
export { schema };

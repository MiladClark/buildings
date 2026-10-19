import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "path";

import * as schema from "./schema";

function databaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const filePath = path.join(process.cwd(), "data", "buildings.db");
  return `file:${filePath}`;
}

const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof createClient>;
};

const client =
  globalForDb.client ??
  createClient({
    url: databaseUrl(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });
export { schema };

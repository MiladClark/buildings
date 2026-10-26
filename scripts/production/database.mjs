import { createClient } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function openDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) {
    throw new Error(
      "Production scripts require a persistent local SQLite DATABASE_URL (file:...).",
    );
  }
  const filename = url.startsWith("file://")
    ? fileURLToPath(url)
    : path.resolve(url.slice(5));
  await mkdir(path.dirname(filename), { recursive: true });
  const client = createClient({ url });
  await client.execute("PRAGMA busy_timeout = 10000");
  await client.execute("PRAGMA foreign_keys = ON");
  return { client, filename };
}

export async function snapshot(client, filename, label) {
  const directory = path.join(path.dirname(filename), "backups");
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const destination = path.join(directory, `${label}-${stamp}.db`);
  await client.execute(`VACUUM INTO '${destination.replaceAll("'", "''")}'`);
  return destination;
}

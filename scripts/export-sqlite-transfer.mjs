import nextEnv from "@next/env";
import { createClient } from "@libsql/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { importOrder, schemaManifest } from "./production/postgres.mjs";
import { canonicalRows, digest } from "./production/import-bundle.mjs";

nextEnv.loadEnvConfig(process.cwd());
const source = process.argv[2] ?? process.env.DATABASE_URL;
if (!source?.startsWith("file:"))
  throw new Error("Pass the original local SQLite file URL.");
const output = process.argv[3] ?? "data/transfer/production.bundle";
await mkdir(path.dirname(output), { recursive: true });
const client = createClient({ url: source });
try {
  const backup = path.resolve(path.dirname(output), `source-${Date.now()}.db`);
  await client.execute(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
  if (
    (await client.execute("PRAGMA quick_check")).rows[0]?.quick_check !== "ok"
  )
    throw new Error("Source integrity check failed.");
  const manifest = await schemaManifest();
  const bundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {},
    files: [],
  };
  // Read from the consistent snapshot; never mutate the original database.
  const snapshot = createClient({ url: `file:${backup}` });
  try {
    for (const table of importOrder) {
      const rows = (
        await snapshot.execute(`SELECT * FROM "${table}"`)
      ).rows.map((row) => ({ ...row }));
      const columns = manifest[table];
      const info = (await snapshot.execute(`PRAGMA table_info("${table}")`))
        .rows;
      if (
        info.length !== Object.keys(columns).length ||
        info.some((row) => !columns[row.name])
      )
        throw new Error(
          `SQLite schema differs for ${table}. Complete legacy upgrades before transferring.`,
        );
      bundle.tables[table] = {
        rows,
        sha256: digest(canonicalRows(rows, columns)),
      };
    }
  } finally {
    snapshot.close();
  }
  const root = process.env.CHAT_UPLOAD_DIR ?? "data/chat-uploads";
  const keys = [
    ...new Set(
      bundle.tables.chat_message.rows
        .filter((row) => !row.deleted_at)
        .map((row) => row.image_key)
        .filter(Boolean),
    ),
  ];
  for (const key of keys) {
    if (!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.webp$/.test(key))
      throw new Error("Invalid source image key.");
    const bytes = await readFile(path.join(root, key));
    bundle.files.push({
      key,
      base64: bytes.toString("base64"),
      sha256: digest(bytes),
    });
  }
  const encoded = gzipSync(JSON.stringify(bundle)).toString("base64");
  await writeFile(output, encoded, { mode: 0o600 });
  console.log(
    JSON.stringify(
      {
        bundlePath: output,
        encodedBytes: encoded.length,
        images: bundle.files.length,
        tables: Object.fromEntries(
          Object.entries(bundle.tables).map(([name, data]) => [
            name,
            data.rows.length,
          ]),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  client.close();
}

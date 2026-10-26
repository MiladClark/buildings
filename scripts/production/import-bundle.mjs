import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { importOrder, schemaManifest } from "./postgres.mjs";

export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function canonicalRows(rows, columns) {
  return rows
    .map((row) =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(columns)
            .sort()
            .map((name) => {
              const value = row[name];
              const type = columns[name].type;
              return [
                name,
                value == null
                  ? null
                  : type === "boolean"
                    ? Number(Boolean(value))
                    : type.startsWith("timestamp")
                      ? typeof value === "number"
                        ? value
                        : new Date(value).getTime()
                      : /^(bigint|integer)$/.test(type)
                        ? Number(value)
                        : value,
              ];
            }),
        ),
      ),
    )
    .sort()
    .join("\n");
}

export function decodeBundle(encoded) {
  const bundle = JSON.parse(
    gunzipSync(Buffer.from(encoded, "base64"), {
      maxOutputLength: 64 * 1024 * 1024,
    }).toString("utf8"),
  );
  if (bundle.version !== 1 || !bundle.tables || !Array.isArray(bundle.files))
    throw new Error("Invalid import bundle.");
  return bundle;
}

// query(sql, parameters) returns rows. transaction(callback) commits or rolls back.
export async function importBundle(
  { query, transaction },
  encoded,
  uploadRoot,
) {
  const bundle = decodeBundle(encoded);
  const fingerprint = digest(JSON.stringify(bundle));
  const manifest = await schemaManifest();
  await query(
    "CREATE TABLE IF NOT EXISTS public._vahedban_import (fingerprint text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT now(), report jsonb NOT NULL)",
  );
  const previous = await query(
    "SELECT fingerprint FROM public._vahedban_import",
  );
  if (previous.length) {
    if (previous[0].fingerprint !== fingerprint)
      throw new Error(
        "A different source was already imported. No data changed.",
      );
    console.log("Existing data transfer already applied.");
    return;
  }
  for (const file of bundle.files) {
    if (!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.webp$/.test(file.key))
      throw new Error("Invalid upload key.");
    const bytes = Buffer.from(file.base64, "base64");
    if (digest(bytes) !== file.sha256)
      throw new Error("Upload checksum mismatch.");
    const filename = path.join(uploadRoot, file.key);
    await mkdir(path.dirname(filename), { recursive: true });
    // Identical retries are safe; never overwrite a different existing image.
    const existing = await readFile(filename).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (existing && digest(existing) !== file.sha256)
      throw new Error("Upload destination already contains a different image.");
    if (!existing) await writeFile(filename, bytes, { flag: "wx" });
  }
  const report = [];
  await transaction(async (q) => {
    for (const table of importOrder) {
      if (
        Number((await q(`SELECT count(*) AS count FROM "${table}"`))[0].count)
      )
        throw new Error(
          "Import requires an empty target. Existing data will never be overwritten.",
        );
    }
    for (const table of importOrder) {
      const source = bundle.tables[table];
      if (!source || !Array.isArray(source.rows))
        throw new Error(`Missing source table: ${table}`);
      const columns = manifest[table];
      for (const row of source.rows) {
        if (Object.keys(row).some((name) => !columns[name]))
          throw new Error(`Unknown column in ${table}`);
        const names = Object.keys(row);
        const values = names.map((name) => {
          const value = row[name];
          if (value == null) return null;
          if (columns[name].type === "boolean") return Boolean(value);
          if (columns[name].type.startsWith("timestamp"))
            return new Date(Number(value)).toISOString();
          return value;
        });
        await q(
          `INSERT INTO "${table}" (${names.map((name) => `"${name}"`).join(",")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(",")})`,
          values,
        );
      }
      const imported = await q(`SELECT * FROM "${table}"`);
      const expected = digest(canonicalRows(source.rows, columns));
      if (
        source.sha256 !== expected ||
        digest(canonicalRows(imported, columns)) !== expected
      )
        throw new Error(
          `Data comparison failed for ${table}; transfer rolled back.`,
        );
      report.push({ table, count: imported.length, sha256: expected });
    }
    await q(
      "INSERT INTO public._vahedban_import (fingerprint, report) VALUES ($1, $2::jsonb)",
      [fingerprint, JSON.stringify(report)],
    );
  });
  console.log(
    `Data transfer verified: ${report.reduce((sum, item) => sum + item.count, 0)} records across ${report.length} tables; ${bundle.files.length} images.`,
  );
}

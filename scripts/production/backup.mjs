import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { openDatabase, snapshot } from "./database.mjs";

const { client, filename } = await openDatabase();
try {
  const destination = await snapshot(client, filename, "scheduled");
  const directory = path.dirname(destination);
  const backups = (await readdir(directory))
    .filter((name) => /^scheduled-.*\.db$/.test(name))
    .sort()
    .reverse();
  for (const name of backups.slice(14))
    await unlink(path.join(directory, name));
  console.log(`Consistent SQLite backup saved: ${destination}`);
} finally {
  client.close();
}

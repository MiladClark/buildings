import { loadEnvConfig } from "@next/env";
import { createClient } from "@libsql/client";

// For existing installations created with db:push (no migration journal).
// Adds the optional unique phone column. Safe to run again.
loadEnvConfig(process.cwd());
const client = createClient({
  url:
    process.argv[2] ?? process.env.DATABASE_URL ?? "file:./data/buildings.db",
});

async function main() {
  const tx = await client.transaction("write");
  try {
    const info = await tx.execute("PRAGMA table_info(user)");
    if (!info.rows.length)
      throw new Error("Missing table: user. Run db:migrate for a new database.");
    if (!info.rows.some((row) => row.name === "phone")) {
      await tx.execute("ALTER TABLE user ADD COLUMN phone text");
    }
    await tx.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS user_phone_unique ON user (phone)",
    );
    await tx.commit();
    console.log("Resident phone migration complete. Existing accounts kept.");
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

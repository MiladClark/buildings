import { loadEnvConfig } from "@next/env";
import { createClient } from "@libsql/client";

// Adds the isolated building-chat tables and indexes to installations created
// with db:push. It is safe to run repeatedly and does not alter financial data.
loadEnvConfig(process.cwd());
const client = createClient({
  url:
    process.argv[2] ?? process.env.DATABASE_URL ?? "file:./data/buildings.db",
});

async function main() {
  const tx = await client.transaction("write");
  try {
    await tx.execute(`
      CREATE TABLE IF NOT EXISTS chat_message (
        id text PRIMARY KEY NOT NULL,
        building_id text NOT NULL,
        user_id text NOT NULL,
        body text DEFAULT '' NOT NULL,
        image_key text,
        image_mime_type text,
        image_name text,
        edited_at integer,
        deleted_at integer,
        created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
        FOREIGN KEY (building_id) REFERENCES building(id) ON DELETE cascade,
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE cascade
      )
    `);
    await tx.execute(`
      CREATE INDEX IF NOT EXISTS idx_chat_message_building_created
      ON chat_message (building_id, created_at)
    `);
    await tx.execute(`
      CREATE INDEX IF NOT EXISTS idx_chat_message_user
      ON chat_message (user_id)
    `);
    await tx.commit();
    console.log("Building chat migration complete.");
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
  process.exitCode = 1;
});

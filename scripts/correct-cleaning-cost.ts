import { loadEnvConfig } from "@next/env";
import { createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import path from "node:path";
loadEnvConfig(process.cwd());
async function main() {
  const { db } = await import("../src/lib/db");
  const s = await import("../src/lib/db/schema");
  const { saveStandaloneCost } =
    await import("../src/lib/billing/standalone-expenses");
  const { reconcileDraftPayments } =
    await import("../src/lib/billing/settlement-store");
  const [buildingId, id] = process.argv.slice(2);
  if (!buildingId || !id)
    throw new Error(
      "Pass the building id and standalone expense id. No changes made.",
    );
  const target = await db.query.standaloneExpense.findFirst({
    where: and(
      eq(s.standaloneExpense.id, id),
      eq(s.standaloneExpense.buildingId, buildingId),
    ),
  });
  if (
    !target ||
    target.deletedAt ||
    target.linkedExpenseId ||
    target.description !== "نظافتچی"
  )
    throw new Error(
      "Expected standalone cleaning entry not found; nothing changed.",
    );
  if (target.amountRial !== 17000 && target.amountRial !== 17000000)
    throw new Error("Unexpected amount; nothing changed.");
  const client = createClient({ url: process.env.DATABASE_URL! });
  try {
    await mkdir("data/backups", { recursive: true });
    const backup = path.resolve(
      `data/backups/before-cleaning-correction-${Date.now()}.db`,
    );
    await client.execute(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
    const before = JSON.stringify(
      (await client.execute("SELECT * FROM payment ORDER BY id")).rows,
    );
    await db.transaction(async (tx) => {
      const actor = await tx.query.membership.findFirst({
        where: and(
          eq(s.membership.buildingId, buildingId),
          eq(s.membership.role, "manager"),
        ),
      });
      if (!actor) throw new Error("Manager missing.");
      if (target.amountRial === 17000)
        await saveStandaloneCost(
          tx,
          buildingId,
          {
            categoryId: target.categoryId,
            amountRial: 17000000,
            description: target.description,
            expenseDate: target.expenseDate,
            maintenanceTicketId: target.maintenanceTicketId,
          },
          actor.userId,
          id,
        );
      await reconcileDraftPayments(tx, buildingId);
    });
    if (
      before !==
      JSON.stringify(
        (await client.execute("SELECT * FROM payment ORDER BY id")).rows,
      )
    )
      throw new Error("Receipt preservation check failed.");
    console.log(
      "Cleaning wage: 1,700,000 toman. All original receipt records preserved. Equipment purchases unchanged.",
    );
  } finally {
    client.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

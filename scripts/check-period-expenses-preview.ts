import { loadEnvConfig } from "@next/env";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
loadEnvConfig(process.cwd());
async function main() {
  assert.match(process.env.DATABASE_URL ?? "", /preview\.db$/);
  const { db } = await import("../src/lib/db");
  const plans = await db.query.periodChargePlan.findMany();
  const plan = plans.find((p) => p.manualMonthlyRial !== null)!;
  assert.ok(plan, "A synthetic period with a saved manual amount is required.");
  const base = "http://127.0.0.1:3301";
  const login = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      email: "manager@preview.local",
      password: process.env.PREVIEW_PASSWORD || "Local-preview-1405!",
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  for (const format of ["pdf", "png"]) {
    const response = await fetch(
      `${base}/api/export/period/${plan.periodId}/expenses/${format}`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-disposition") ?? "",
      /attachment/,
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(
      format === "pdf"
        ? bytes.subarray(0, 4).toString()
        : bytes.subarray(1, 4).toString(),
      format === "pdf" ? "%PDF" : "PNG",
    );
    await writeFile(`artifacts/verified-manual-charge.${format}`, bytes);
  }
  console.log(
    `Verified PDF and PNG downloads for a saved manual monthly charge of ${plan.manualMonthlyRial! / 10} toman.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

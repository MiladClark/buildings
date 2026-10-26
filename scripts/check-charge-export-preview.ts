import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3301";
async function main() {
  const ids = JSON.parse(await readFile("tmp/pdfs/preview-ids.json", "utf8"));
  const login = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      email: "manager@preview.local",
      password: process.env.PREVIEW_PASSWORD ?? "Local-preview-1405!",
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  await mkdir("output/pdf", { recursive: true });
  for (const format of ["pdf", "png"]) {
    for (const kind of ["invoice", "period"]) {
      const url =
        kind === "invoice"
          ? `/api/export/invoice/${ids.invoiceId}/${format}`
          : `/api/export/period/${ids.periodId}/expenses/${format}`;
      const response = await fetch(base + url, { headers: { Cookie: cookie } });
      assert.equal(response.status, 200, url);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(
        format === "pdf"
          ? bytes.subarray(0, 4).toString()
          : bytes.subarray(1, 4).toString(),
        format === "pdf" ? "%PDF" : "PNG",
      );
      await writeFile(
        `${kind === "invoice" ? "output/pdf/invoice-charge-preview" : "tmp/pdfs/period-charge-preview"}.${format}`,
        bytes,
      );
    }
  }
  const long = await fetch(
    `${base}/api/export/period/${ids.longPeriodId}/expenses/pdf`,
    { headers: { Cookie: cookie } },
  );
  assert.equal(long.status, 200);
  await writeFile(
    "tmp/pdfs/long-period.pdf",
    Buffer.from(await long.arrayBuffer()),
  );
  console.log(
    "Verified both PDF and PNG export routes with an issued monthly charge.",
  );
  for (const [key, name] of [
    ["absentInvoiceId", "invoice-absent"],
    ["longInvoiceId", "invoice-long"],
  ] as const) {
    const result = await fetch(`${base}/api/export/invoice/${ids[key]}/pdf`, {
      headers: { Cookie: cookie },
    });
    assert.equal(result.status, 200, key);
    await writeFile(
      `tmp/pdfs/${name}.pdf`,
      Buffer.from(await result.arrayBuffer()),
    );
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

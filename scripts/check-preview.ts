import { loadEnvConfig } from "@next/env";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DATABASE_URL?.endsWith("/preview.db"))
    throw new Error("Only the preview database is allowed.");
  const base = "http://127.0.0.1:3301";
  const { db } = await import("../src/lib/db");
  const { eq } = await import("drizzle-orm");
  const s = await import("../src/lib/db/schema");
  const units = await db.select().from(s.unit);
  const own = units.find((u) => u.label === "1")!;
  const invoices = await db.select().from(s.unitInvoice);
  const invoice = invoices.find((i) => i.unitId === own.id)!;
  const foreign = invoices.find((i) => i.unitId !== own.id)!;
  async function login(email: string) {
    const r = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({
        email,
        password: process.env.PREVIEW_PASSWORD || "Local-preview-1405!",
      }),
    });
    assert.equal(r.status, 200, "login");
    return r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  }
  const manager = await login("manager@preview.local");
  async function get(
    path: string,
    cookie: string | undefined,
    status: number,
    filename?: string,
  ) {
    const r = await fetch(base + path, {
      headers: cookie ? { Cookie: cookie } : {},
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(r.status, status, path);
    const bytes = Buffer.from(await r.arrayBuffer());
    if (filename) await writeFile(`artifacts/${filename}`, bytes);
    console.log(
      `${status} ${path.split("/").slice(0, 4).join("/")} (${bytes.length} bytes)`,
    );
    return bytes;
  }
  const pdf = await get(
    `/api/export/invoice/${invoice.id}/pdf`,
    manager,
    200,
    "verified-invoice.pdf",
  );
  assert.ok(pdf.subarray(0, 4).toString() === "%PDF");
  const png = await get(
    `/api/export/invoice/${invoice.id}/png`,
    manager,
    200,
    "verified-invoice.png",
  );
  assert.ok(png.subarray(1, 4).toString() === "PNG");
  const excel = await get(
    "/api/export/finance",
    manager,
    200,
    "verified-finance.xlsx",
  );
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    excel as unknown as Parameters<typeof book.xlsx.load>[0],
  );
  assert.equal(book.worksheets.length, 3);
  assert.equal(book.worksheets[0].rowCount, 9);
  for (const sheet of book.worksheets) {
    assert.ok(!JSON.stringify(sheet.getRow(1).values).includes("ریال"));
    assert.ok(JSON.stringify(sheet.getRow(1).values).includes("تومان"));
  }
  const ownBalanceRow = book.worksheets[0]
    .getRows(2, units.length)!
    .find((r) => r.getCell(1).value === own.label)!;
  const ownPayments = await db
    .select()
    .from(s.payment)
    .where(eq(s.payment.unitId, own.id));
  assert.equal(
    ownBalanceRow.getCell(5).value,
    ownPayments.reduce((sum, p) => sum + p.amountRial, 0) / 10,
  );
  const expenses = await db.select().from(s.expenseLine);
  const exportedCosts = book.worksheets[1]
    .getRows(2, book.worksheets[1].rowCount - 1)!
    .reduce((sum, r) => sum + Number(r.getCell(4).value), 0);
  assert.ok(
    Math.abs(
      exportedCosts - expenses.reduce((sum, e) => sum + e.amountRial, 0) / 10,
    ) < 0.001,
  );
  const periodExcel = await get(
    `/api/export/period/${invoice.periodId}/excel`,
    manager,
    200,
  );
  const periodBook = new ExcelJS.Workbook();
  await periodBook.xlsx.load(
    periodExcel as unknown as Parameters<typeof periodBook.xlsx.load>[0],
  );
  assert.equal(
    periodBook.worksheets[0].getRow(1).getCell(2).value,
    "جمع (تومان)",
  );
  const ownPeriodRow = periodBook.worksheets[0]
    .getRows(2, units.length)!
    .find((r) => r.getCell(1).value === own.label)!;
  assert.equal(ownPeriodRow.getCell(2).value, invoice.totalRial / 10);
  const resident = await login("resident@preview.local");
  const periods = await db.select().from(s.billingPeriod);
  const draft = periods.find(
    (p) =>
      p.status === "draft" &&
      !p.deletedAt &&
      expenses.some((e) => e.periodId === p.id && !e.deletedAt),
  )!;
  const empty = periods.find(
    (p) =>
      p.status === "draft" &&
      !p.deletedAt &&
      !expenses.some((e) => e.periodId === p.id && !e.deletedAt),
  )!;
  const deleted = periods.find((p) => p.deletedAt);
  for (const format of ["pdf", "png"]) {
    for (const [kind, periodId] of [
      ["issued", invoice.periodId],
      ["draft", draft.id],
      ["empty", empty.id],
    ]) {
      const bytes = await get(
        `/api/export/period/${periodId}/expenses/${format}`,
        manager,
        200,
        `verified-period-expenses-${kind}.${format}`,
      );
      assert.equal(
        format === "pdf"
          ? bytes.subarray(0, 4).toString()
          : bytes.subarray(1, 4).toString(),
        format === "pdf" ? "%PDF" : "PNG",
      );
    }
    await get(
      `/api/export/period/${invoice.periodId}/expenses/${format}`,
      resident,
      403,
    );
    await get(
      `/api/export/period/${invoice.periodId}/expenses/${format}`,
      undefined,
      401,
    );
    await get(`/api/export/period/missing/expenses/${format}`, manager, 404);
    if (deleted)
      await get(
        `/api/export/period/${deleted.id}/expenses/${format}`,
        manager,
        404,
      );
  }
  for (const page of ["/resident", "/resident/payments"]) {
    const html = (await get(page, resident, 200)).toString("utf8");
    assert.ok(
      !html.includes(foreign.unitId),
      "Resident page must not expose another unit's financial state",
    );
    assert.ok(
      html.includes(
        page === "/resident" ? "تسویه به تفکیک هزینه" : "بابت کدام هزینه",
      ),
      "Cost settlement controls are visible to the resident",
    );
  }
  await get(`/api/export/invoice/${invoice.id}/pdf`, resident, 200);
  await get(`/api/export/invoice/${foreign.id}/pdf`, resident, 404);
  await get("/api/export/finance", resident, 403);
  await get("/api/export/finance", undefined, 401);
  await get(`/api/export/invoice/${invoice.id}/png`, undefined, 404);
  const requests = await db
    .select()
    .from(s.paymentRequest)
    .where(eq(s.paymentRequest.unitId, own.id));
  console.log(
    `Verified exports and access controls. ${requests.length} test payment request(s).`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

import { loadEnvConfig } from "@next/env";
import { writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
loadEnvConfig(process.cwd());
async function main() {
  const invoiceId = process.argv[2];
  if (!invoiceId || !/^[a-zA-Z0-9-]+$/.test(invoiceId))
    throw new Error("Pass an invoice id.");
  const { db } = await import("../src/lib/db");
  const s = await import("../src/lib/db/schema");
  const { getFinanceData } = await import("../src/lib/queries/finance");
  const { explainInvoice } =
    await import("../src/lib/export/invoice-explanation");
  const { invoiceRecipient } =
    await import("../src/lib/export/invoice-recipient");
  const { invoiceExportSummary } =
    await import("../src/lib/export/invoice-summary");
  const { renderInvoiceImage } =
    await import("../src/lib/export/invoice-image");
  const { formatToman, toPersianDigits: fa } =
    await import("../src/lib/format/money");
  const { formatJalaliDate } = await import("../src/lib/format/jalali");
  const { invoiceExportFilename } = await import("../src/lib/export/filenames");
  const invoice = await db.query.unitInvoice.findFirst({
    where: eq(s.unitInvoice.id, invoiceId),
  });
  if (!invoice) throw new Error("Invoice missing.");
  const period = await db.query.billingPeriod.findFirst({
    where: eq(s.billingPeriod.id, invoice.periodId),
  });
  if (!period || period.deletedAt || period.status === "draft")
    throw new Error("Issued period missing.");
  const data = await getFinanceData(period.buildingId);
  const ownUnit = data.units.find((u) => u.id === invoice.unitId)!;
  const snapshots = await db
    .select()
    .from(s.periodSnapshot)
    .where(eq(s.periodSnapshot.periodId, period.id));
  const explanation = explainInvoice(data, invoiceId, snapshots);
  const summary = invoiceExportSummary(
    data.invoiceLines.filter((l) => l.invoiceId === invoiceId),
    invoice.totalRial,
  );
  const output = `output/pdf/${invoiceExportFilename(ownUnit.label, "png")}`;
  await writeFile(
    "tmp/pdfs/unit-invoice-data.json",
    JSON.stringify({
      buildingName: data.settings!.name,
      periodTitle: period.title,
      unitLabel: fa(ownUnit.label),
      recipient: invoiceRecipient(ownUnit),
      bankAccount: data.settings!.bankAccount,
      bankSheba: data.settings!.bankSheba,
      dueDate: period.dueDate ? formatJalaliDate(period.dueDate) : undefined,
      totalRial: invoice.totalRial,
      paidRial: invoice.paidRial,
      balanceRial: invoice.balanceRial,
      explanation,
    }),
  );
  await writeFile(
    output,
    await renderInvoiceImage({
      buildingName: data.settings!.name,
      periodTitle: period.title,
      unitLabel: fa(ownUnit.label),
      recipient: invoiceRecipient(ownUnit),
      dueDate: period.dueDate ? formatJalaliDate(period.dueDate) : undefined,
      bankAccount: data.settings!.bankAccount,
      bankSheba: data.settings!.bankSheba,
      total: formatToman(invoice.totalRial),
      expensesTotal: formatToman(summary.expensesTotalRial),
      charge: summary.chargeTotalRial
        ? formatToman(summary.chargeTotalRial)
        : undefined,
      fund: period.chargeModel === "fund",
      paid: formatToman(invoice.paidRial),
      paidRial: invoice.paidRial,
      balance: formatToman(invoice.balanceRial),
      lines: summary.lines.map((l) => ({
        title: l.title,
        basis: l.basis,
        amount: formatToman(l.amountRial),
      })),
      explanation,
    }),
  );
  console.log(
    JSON.stringify({
      output,
      costRows: explanation.costRows.length,
      totalToman: invoice.totalRial / 10,
      balanceToman: invoice.balanceRial / 10,
      assessmentOrder: explanation.assessments.map((r) => r.title),
    }),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

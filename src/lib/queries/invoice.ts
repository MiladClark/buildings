import { getSession, getMembershipForUser } from "@/lib/session";
import { getFinanceData } from "./finance";
import { invoiceExportSummary } from "@/lib/export/invoice-summary";
import { invoiceRecipient } from "@/lib/export/invoice-recipient";
import { explainInvoice } from "@/lib/export/invoice-explanation";
import { db } from "@/lib/db";
import { periodSnapshot } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getInvoiceExportData(invoiceId: string) {
  const session = await getSession();
  if (!session) return null;
  const member = await getMembershipForUser(session.user.id);
  if (!member) return null;
  const data = await getFinanceData(member.buildingId);
  const found = data.invoices.find(
    (r) =>
      r.invoice.id === invoiceId &&
      r.period.status !== "draft" &&
      (member.role === "manager" || r.invoice.unitId === member.unitId),
  );
  if (!found || !data.settings) return null;
  const ownUnit = data.units.find((u) => u.id === found.invoice.unitId);
  if (!ownUnit) return null;
  const lines = data.invoiceLines
    .filter((l) => l.invoiceId === invoiceId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const snapshots = await db
    .select()
    .from(periodSnapshot)
    .where(eq(periodSnapshot.periodId, found.period.id));
  return {
    building: data.settings,
    invoice: found.invoice,
    period: found.period,
    unit: ownUnit,
    recipient: invoiceRecipient(ownUnit),
    explanation: explainInvoice(data, invoiceId, snapshots),
    ...invoiceExportSummary(lines, found.invoice.totalRial),
  };
}

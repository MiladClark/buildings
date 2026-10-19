import { getSession, getMembershipForUser } from "@/lib/session";
import { getFinanceData } from "./finance";
import { formatToman } from "@/lib/format/money";
import { invoiceRecipient } from "@/lib/export/invoice-recipient";

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
  const settlements = data.settlement.shares.filter(
    (s) => s.unitId === ownUnit.id && s.periodId === found.period.id,
  );
  const remaining = new Map(settlements.map((s) => [s.categoryId, s.paidRial]));
  return {
    building: data.settings,
    invoice: found.invoice,
    period: found.period,
    unit: ownUnit,
    recipient: invoiceRecipient(ownUnit),
    lines: lines.map((line) => {
      const paid = Math.min(
        line.amountRial,
        remaining.get(line.categoryId) ?? 0,
      );
      remaining.set(
        line.categoryId,
        (remaining.get(line.categoryId) ?? 0) - paid,
      );
      const state =
        line.amountRial === 0
          ? "سهم ندارد"
          : paid === line.amountRial
            ? "تسویه‌شده"
            : `پرداخت ${formatToman(paid)}؛ مانده ${formatToman(line.amountRial - paid)}`;
      return {
        ...line,
        basis: [line.basis, state].filter(Boolean).join(" · "),
      };
    }),
  };
}

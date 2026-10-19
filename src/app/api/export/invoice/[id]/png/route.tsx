import { formatToman, toPersianDigits } from "@/lib/format/money";
import { formatJalaliDate } from "@/lib/format/jalali";
import { getInvoiceExportData } from "@/lib/queries/invoice";
import { renderInvoiceImage } from "@/lib/export/invoice-image";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await getInvoiceExportData(id);
  if (!data) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const image = await renderInvoiceImage({
    buildingName: data.building.name,
    periodTitle: data.period.title,
    unitLabel: toPersianDigits(data.unit.label),
    recipient: data.recipient,
    dueDate: data.period.dueDate
      ? formatJalaliDate(data.period.dueDate)
      : undefined,
    bankAccount: data.building.bankAccount,
    bankSheba: data.building.bankSheba,
    total: formatToman(data.invoice.totalRial),
    paid: formatToman(data.invoice.paidRial),
    balance: formatToman(data.invoice.balanceRial),
    lines: data.lines.map((l) => ({
      title: l.title,
      basis: l.basis ? toPersianDigits(l.basis) : null,
      amount: formatToman(l.amountRial),
    })),
  });
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="invoice-${id}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { InvoicePdfDocument } from "@/lib/pdf/invoice-document";
import { getInvoiceExportData } from "@/lib/queries/invoice";
import { formatJalaliDate } from "@/lib/format/jalali";
import { toPersianDigits } from "@/lib/format/money";
import {
  attachmentDisposition,
  invoiceExportFilename,
} from "@/lib/export/filenames";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await getInvoiceExportData(id);
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    <InvoicePdfDocument
      buildingName={data.building?.name ?? "ساختمان"}
      fund={data.period.chargeModel === "fund"}
      explanation={data.explanation}
      periodTitle={data.period.title}
      unitLabel={toPersianDigits(data.unit.label)}
      recipient={data.recipient}
      bankAccount={data.building?.bankAccount}
      bankSheba={data.building?.bankSheba}
      lines={data.lines.map((l) => ({
        title: l.title,
        basis: l.basis,
        amountRial: l.amountRial,
      }))}
      totalRial={data.invoice.totalRial}
      expensesTotalRial={data.expensesTotalRial}
      chargeTotalRial={data.chargeTotalRial}
      balanceRial={data.invoice.balanceRial}
      paidRial={data.invoice.paidRial}
      dueDate={
        data.period.dueDate ? formatJalaliDate(data.period.dueDate) : undefined
      }
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": attachmentDisposition(
        invoiceExportFilename(data.unit.label, "pdf"),
      ),
      "Cache-Control": "private, no-store",
    },
  });
}

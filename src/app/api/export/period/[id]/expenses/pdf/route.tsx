import { renderToBuffer } from "@react-pdf/renderer";
import { getPeriodExpensesExportData } from "@/lib/queries/period-expenses";
import { PeriodExpensesPdfDocument } from "@/lib/pdf/period-expenses-document";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await getPeriodExpensesExportData(id);
  if (!result.ok)
    return Response.json({ error: result.error }, { status: result.status });
  const pdf = await renderToBuffer(
    <PeriodExpensesPdfDocument report={result.data} />,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="period-expenses-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { getPeriodExpensesExportData } from "@/lib/queries/period-expenses";
import { renderPeriodExpensesImage } from "@/lib/export/period-expenses-image";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await getPeriodExpensesExportData(id);
  if (!result.ok)
    return Response.json({ error: result.error }, { status: result.status });
  const png = await renderPeriodExpensesImage(result.data);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="period-expenses-${id}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { billingPeriod, unit, unitInvoice } from "@/lib/db/schema";
import { getSession, getMembershipForUser } from "@/lib/session";
import { toToman } from "@/lib/format/money";
import {
  attachmentDisposition,
  datedExportFilename,
} from "@/lib/export/filenames";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const member = await getMembershipForUser(session.user.id);
  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, id),
  });
  if (
    !period ||
    period.deletedAt ||
    period.status === "draft" ||
    !member ||
    member.role !== "manager" ||
    member.buildingId !== period.buildingId
  )
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rows = await db
    .select({
      invoice: unitInvoice,
      unit,
    })
    .from(unitInvoice)
    .innerJoin(unit, eq(unitInvoice.unitId, unit.id))
    .where(eq(unitInvoice.periodId, id));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("شارژ", {
    views: [{ rightToLeft: true }],
  });
  sheet.columns = [
    { header: "واحد", key: "unit", width: 12 },
    { header: "جمع (تومان)", key: "total", width: 20 },
    { header: "پرداخت (تومان)", key: "paid", width: 20 },
    { header: "مانده (تومان)", key: "balance", width: 20 },
  ];

  for (const row of rows) {
    sheet.addRow({
      unit: row.unit.label,
      total: toToman(row.invoice.totalRial),
      paid: toToman(row.invoice.paidRial),
      balance: toToman(row.invoice.balanceRial),
    });
  }

  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": attachmentDisposition(
        datedExportFilename("فیش‌های-دوره", "xlsx"),
      ),
      "Cache-Control": "private, no-store",
    },
  });
}

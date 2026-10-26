import ExcelJS from "exceljs";
import { getSession, getMembershipForUser } from "@/lib/session";
import { dashboardData, getFinanceData } from "@/lib/queries/finance";
import { formatJalaliDate } from "@/lib/format/jalali";
import { toToman } from "@/lib/format/money";
import {
  attachmentDisposition,
  datedExportFilename,
} from "@/lib/export/filenames";
export async function GET() {
  const s = await getSession();
  if (!s) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const m = await getMembershipForUser(s.user.id);
  if (!m || m.role !== "manager")
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const data = await getFinanceData(m.buildingId);
  const d = dashboardData(data);
  const book = new ExcelJS.Workbook();
  book.creator = "هم‌خانه";
  book.created = new Date();
  const balances = book.addWorksheet("مانده واحدها", {
    views: [{ rightToLeft: true }],
  });
  balances.columns = [
    { header: "واحد", key: "unit", width: 15 },
    { header: "ساکن", key: "name", width: 25 },
    { header: "نفرات حاضر", key: "occupants", width: 14 },
    { header: "حضور", key: "presence", width: 20 },
    { header: "پرداخت کل (تومان)", key: "paid", width: 22 },
    { header: "مانده (تومان)", key: "balance", width: 22 },
    { header: "بدهی فیش‌ها (تومان)", key: "debt", width: 24 },
    { header: "بستانکاری آزاد (تومان)", key: "credit", width: 24 },
    { header: "پیش‌پرداخت محفوظ (تومان)", key: "reserved", width: 26 },
  ];
  d.summaries.forEach((u) =>
    balances.addRow({
      unit: u.label,
      name: u.name,
      occupants: u.occupants,
      presence: u.deleted
        ? "حذف‌شده از محاسبات جدید"
        : u.temporarilyAbsent
          ? "غایب موقت"
          : u.occupancy === "empty"
            ? "خالی"
            : "ساکن",
      paid: toToman(u.paid),
      balance: toToman(u.balance),
      debt: toToman(u.debt),
      credit: toToman(u.credit),
      reserved: toToman(u.reserved),
    }),
  );
  const expenses = book.addWorksheet("هزینه‌ها", {
    views: [{ rightToLeft: true }],
  });
  expenses.columns = [
    { header: "دسته", key: "category", width: 22 },
    { header: "شرح", key: "description", width: 45 },
    { header: "تاریخ", key: "date", width: 18 },
    { header: "مبلغ (تومان)", key: "amount", width: 22 },
    { header: "دوره", key: "period", width: 25 },
  ];
  data.expenses.forEach(({ expense: e, category: c }) =>
    expenses.addRow({
      category: c.name,
      description: e.description || "",
      date: formatJalaliDate(e.expenseDate),
      amount: toToman(e.amountRial),
      period: data.periods.find((p) => p.id === e.periodId)?.title,
    }),
  );
  const payments = book.addWorksheet("واریزها", {
    views: [{ rightToLeft: true }],
  });
  payments.columns = [
    { header: "واحد", key: "unit", width: 15 },
    { header: "تاریخ", key: "date", width: 18 },
    { header: "مبلغ (تومان)", key: "amount", width: 22 },
    { header: "شرح", key: "note", width: 45 },
    { header: "بابت", key: "purpose", width: 45 },
    { header: "نوع ثبت", key: "kind", width: 25 },
  ];
  data.payments.forEach(({ payment: p, unit: u }) =>
    payments.addRow({
      unit: u.label,
      date: formatJalaliDate(p.paidAt),
      amount: toToman(p.amountRial),
      note: p.note || "",
      kind: p.kind === "advance" ? "پرداخت مستقیم؛ طلب واحد" : "واریز به مدیر",
      purpose: p.standaloneExpenseId
        ? (data.standaloneExpenses.find((c) => c.id === p.standaloneExpenseId)
            ?.description ?? "هزینه مستقل")
        : p.categoryId
          ? `${data.categories.find((c) => c.id === p.categoryId)?.name ?? "هزینه"} · ${data.periods.find((r) => r.id === p.periodId)?.title ?? "دوره حذف‌شده"}`
          : "واریز عمومی",
    }),
  );
  for (const cost of data.standaloneExpenses.filter(
    (c) => !c.deletedAt && !c.linkedExpenseId,
  ))
    expenses.addRow({
      category: data.categories.find((c) => c.id === cost.categoryId)?.name,
      description: cost.description,
      date: formatJalaliDate(cost.expenseDate),
      amount: toToman(cost.amountRial),
      period: "مستقل؛ خارج از شارژ",
    });
  for (const sheet of book.worksheets) {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF26745D" },
    };
    sheet.getRow(1).height = 28;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sheet.rowCount, column: sheet.columnCount },
    };
    sheet.eachRow((r, n) => {
      if (n > 1) r.height = 23;
      r.alignment = { horizontal: "right", vertical: "middle" };
    });
  }
  const buffer = await book.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": attachmentDisposition(
        datedExportFilename("گزارش-مالی", "xlsx"),
      ),
      "Cache-Control": "private, no-store",
    },
  });
}

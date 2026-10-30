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
  book.creator = "واحدبان";
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
  const bills = book.addWorksheet("قبوض", { views: [{ rightToLeft: true }] });
  bills.columns = [
    { header: "شرح", key: "title", width: 35 },
    { header: "شناسه قبض", key: "billId", width: 22 },
    { header: "شناسه پرداخت", key: "paymentId", width: 22 },
    { header: "اشتراک", key: "subscriptionId", width: 22 },
    { header: "کنتور", key: "meterNumber", width: 22 },
    { header: "صدور", key: "issuedOn", width: 18 },
    { header: "دریافت", key: "receivedOn", width: 18 },
    { header: "قرائت قبلی", key: "periodStart", width: 18 },
    { header: "قرائت فعلی", key: "periodEnd", width: 18 },
    { header: "مهلت پرداخت", key: "dueOn", width: 18 },
    { header: "مبلغ کل (تومان)", key: "amount", width: 22 },
    { header: "پرداخت واقعی (تومان)", key: "paid", width: 24 },
    { header: "وضعیت", key: "status", width: 22 },
  ];
  for (const cost of data.treasury.costs.filter((c) => c.utilityBill)) {
    const bill = cost.utilityBill!;
    const billDate = (v: string) =>
      v ? formatJalaliDate(new Date(`${v}T12:00:00Z`)) : "";
    bills.addRow({
      title: cost.title,
      billId: bill.billId,
      paymentId: bill.paymentId,
      subscriptionId: bill.subscriptionId,
      meterNumber: bill.meterNumber,
      issuedOn: billDate(bill.issuedOn),
      receivedOn: billDate(bill.receivedOn),
      periodStart: billDate(bill.periodStart),
      periodEnd: billDate(bill.periodEnd),
      dueOn: billDate(bill.dueOn),
      amount: toToman(cost.estimateRial),
      paid: toToman(cost.paidRial),
      status: cost.state,
    });
  }
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
  const fund = book.addWorksheet("حساب ساختمان", {
    views: [{ rightToLeft: true }],
  });
  fund.columns = [
    { header: "عنوان", key: "label", width: 45 },
    { header: "مبلغ (تومان)", key: "amount", width: 25 },
  ];
  for (const [label, amount] of [
    ["دریافت تأییدشده", data.treasury.receivedRial],
    ["پرداخت واقعی از حساب", data.treasury.paidRial],
    ["موجودی حساب", data.treasury.balanceRial],
    ["مانده برآورد پرداخت‌نشده", data.treasury.pendingRial],
  ] as const)
    fund.addRow({ label, amount: toToman(amount) });
  const status = book.addWorksheet("وضعیت پرداخت هزینه‌ها", {
    views: [{ rightToLeft: true }],
  });
  status.columns = [
    { header: "هزینه", key: "title", width: 40 },
    { header: "دسته", key: "category", width: 20 },
    { header: "برآورد (تومان)", key: "estimate", width: 22 },
    { header: "پرداخت از حساب (تومان)", key: "fund", width: 25 },
    { header: "از جیب واحدها (تومان)", key: "direct", width: 25 },
    { header: "مبلغ نهایی (تومان)", key: "actual", width: 25 },
    { header: "مانده برآورد (تومان)", key: "remaining", width: 25 },
    { header: "وضعیت", key: "state", width: 25 },
  ];
  data.treasury.costs.forEach((c) =>
    status.addRow({
      title: c.title,
      category: c.category,
      estimate: toToman(c.estimateRial),
      fund: toToman(c.paidFromFundRial),
      direct: toToman(c.directRial),
      actual: c.actualRial == null ? null : toToman(c.actualRial),
      remaining: toToman(c.remainingRial),
      state: c.state,
    }),
  );
  const outlays = book.addWorksheet("اسناد پرداخت از حساب", {
    views: [{ rightToLeft: true }],
  });
  outlays.columns = [
    { header: "شناسه سند", key: "id", width: 40 },
    { header: "بابت", key: "title", width: 40 },
    { header: "گیرنده", key: "payee", width: 25 },
    { header: "تاریخ پرداخت", key: "date", width: 18 },
    { header: "مبلغ (تومان)", key: "amount", width: 22 },
    { header: "روش", key: "method", width: 18 },
    { header: "شماره پیگیری", key: "reference", width: 25 },
    { header: "توضیح", key: "note", width: 40 },
    { header: "وضعیت", key: "state", width: 20 },
    { header: "تاریخ لغو", key: "cancelled", width: 18 },
    { header: "دلیل لغو", key: "reason", width: 40 },
  ];
  const items = book.addWorksheet("ریز خرید", {
    views: [{ rightToLeft: true }],
  });
  items.columns = [
    { header: "شناسه سند", key: "id", width: 40 },
    { header: "نام کالا", key: "description", width: 35 },
    { header: "مبلغ (تومان)", key: "amount", width: 22 },
    { header: "وضعیت سند", key: "state", width: 20 },
  ];
  for (const d of data.disbursements) {
    const state = d.cancelledAt
      ? "لغوشده؛ بدون اثر بر موجودی"
      : d.finalPayment
        ? "پرداخت نهایی"
        : "علی‌الحساب";
    const cost = data.treasury.costs.find((c) =>
      d.standaloneExpenseId
        ? c.target.standaloneExpenseId === d.standaloneExpenseId
        : c.target.expenseId === d.expenseId,
    );
    outlays.addRow({
      id: d.id,
      title: cost?.title ?? "هزینه بایگانی‌شده",
      payee: d.payee,
      date: formatJalaliDate(d.paidAt),
      amount: toToman(d.amountRial),
      method:
        d.method === "cash"
          ? "نقدی"
          : d.method === "bank_transfer"
            ? "بانکی"
            : "سایر",
      reference: d.reference,
      note: d.note,
      state,
      cancelled: d.cancelledAt ? formatJalaliDate(d.cancelledAt) : "",
      reason: d.cancellationReason,
    });
    d.items.forEach((i) =>
      items.addRow({
        id: d.id,
        description: i.description,
        amount: toToman(i.amountRial),
        state,
      }),
    );
  }
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

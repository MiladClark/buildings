import type { FinanceData } from "@/lib/queries/finance";
import { formatJalaliDate, jalaliMonthSpan } from "@/lib/format/jalali";
import { formatToman, toPersianDigits as fa } from "@/lib/format/money";
import { monthlyChargeCategoryId } from "@/lib/billing/monthly-charge";
import { effectiveOccupants } from "@/lib/billing/occupancy";
import type { UnitStatus } from "@/lib/billing/types";

export type InvoiceExplanation = {
  periodRange: string;
  occupancy: string;
  costRows: {
    title: string;
    category: string;
    date: string;
    buildingRial: number;
    unitRial: number;
    funded: boolean;
    reason: string;
  }[];
  assessments: { title: string; amountRial: number; reason: string }[];
  notes: string[];
  payments: { title: string; date: string; amountRial: number }[];
  accountNotes: string[];
};
type Snapshot = {
  unitId: string;
  occupantCount: number;
  temporarilyAbsent: boolean;
  status: UnitStatus;
};

/** Allocate an already recorded total; preserve all integer remainders, including ties. */
function partition(total: number, weights: { id: string; weight: number }[]) {
  const sum = weights.reduce((s, w) => s + w.weight, 0);
  const rows = weights.map((w) => {
    const exact = sum ? (total * w.weight) / sum : 0;
    return {
      id: w.id,
      amount: Math.floor(exact),
      fraction: exact - Math.floor(exact),
    };
  });
  let left = total - rows.reduce((s, r) => s + r.amount, 0);
  if (sum > 0)
    for (const row of [...rows].sort(
      (a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id),
    ))
      if (left-- > 0) row.amount++;
  return new Map(rows.map((r) => [r.id, r.amount]));
}
const percent = (part: number, total: number) =>
  total > 0
    ? `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format((part / total) * 100)}٪`
    : "۰٪";

export function explainInvoice(
  data: FinanceData,
  invoiceId: string,
  snapshots: Snapshot[],
): InvoiceExplanation {
  const own = data.invoices.find((r) => r.invoice.id === invoiceId);
  if (!own) throw new Error("فیش پیدا نشد.");
  const { invoice, period } = own;
  const periodInvoices = data.invoices
    .filter((r) => r.invoice.periodId === period.id)
    .map((r) => r.invoice);
  const invoiceIds = new Set(periodInvoices.map((i) => i.id));
  const allLines = data.invoiceLines.filter((l) => invoiceIds.has(l.invoiceId));
  const baseId = monthlyChargeCategoryId(period.buildingId);
  const ownLines = allLines
    .filter((l) => l.invoiceId === invoiceId)
    .toSorted(
      (a, b) =>
        Number(b.categoryId === baseId) - Number(a.categoryId === baseId) ||
        a.sortOrder - b.sortOrder ||
        a.id.localeCompare(b.id),
    );
  const base = ownLines
    .filter((l) => l.categoryId === baseId)
    .reduce((s, l) => s + l.amountRial, 0);
  const fund = period.chargeModel === "fund";
  const monthCount = jalaliMonthSpan(period.startDate, period.endDate);
  const ownSnapshot = snapshots.find((s) => s.unitId === invoice.unitId);
  const population = snapshots.reduce((s, u) => s + effectiveOccupants(u), 0);
  const present = ownSnapshot ? effectiveOccupants(ownSnapshot) : null;
  const costs = data.expenses
    .filter(
      (r) =>
        r.expense.periodId === period.id &&
        !r.expense.deletedAt &&
        r.category.allocationMethod !== "excluded",
    )
    .toSorted(
      (a, b) =>
        (a.category.sortOrder ?? 0) - (b.category.sortOrder ?? 0) ||
        a.expense.expenseDate.getTime() - b.expense.expenseDate.getTime() ||
        (a.expense.description ?? "").localeCompare(
          b.expense.description ?? "",
          "fa",
          { numeric: true },
        ) ||
        a.expense.id.localeCompare(b.expense.id),
    );
  const baseWeights = periodInvoices.map((i) => ({
    id: i.unitId,
    weight: allLines
      .filter((l) => l.invoiceId === i.id && l.categoryId === baseId)
      .reduce((s, l) => s + l.amountRial, 0),
  }));
  const baseSum = baseWeights.reduce((s, w) => s + w.weight, 0);
  if (!baseSum) for (const weight of baseWeights) weight.weight = 1;
  const baseDenominator = baseSum || periodInvoices.length;
  const baseNumerator = baseSum ? base : 1;
  const isPerPerson = (id: string) =>
    allLines.some((l) => l.categoryId === id && l.basis?.includes("نفر"));
  const isFunded = (r: (typeof costs)[number]) =>
    fund &&
    r.expense.billingTreatment !== "separate" &&
    !isPerPerson(r.category.id) &&
    r.category.allocationMethod !== "per_person";
  const separate = costs.filter((r) => !isFunded(r));
  const costRows = costs.map(({ expense: e, category: c }) => {
    const funded = isFunded({ expense: e, category: c });
    const categoryOwn = ownLines
      .filter((l) => l.categoryId === c.id)
      .reduce((s, l) => s + l.amountRial, 0);
    const categoryTotal = allLines
      .filter((l) => l.categoryId === c.id)
      .reduce((s, l) => s + l.amountRial, 0);
    const unitRial = funded
      ? (partition(e.amountRial, baseWeights).get(invoice.unitId) ?? 0)
      : (partition(
          categoryOwn,
          separate
            .filter((r) => r.category.id === c.id)
            .map((r) => ({ id: r.expense.id, weight: r.expense.amountRial })),
        ).get(e.id) ?? 0);
    let reason: string;
    if (funded)
      reason = `از محل شارژ پایه؛ نسبت واحد از بودجه مشترک ${percent(baseNumerator, baseDenominator)}. این مبلغ دوباره دریافت نمی‌شود.`;
    else if (isPerPerson(c.id) && present !== null)
      reason = `${fa(String(present))} نفر حاضر از ${fa(String(population))} نفر ساختمان؛ سهم ${percent(present, population)}.${present === 0 ? " واحد بدون فرد حاضر، سهم آب ندارد." : ""}`;
    else
      reason = `${ownLines.find((l) => l.categoryId === c.id)?.basis ?? "مطابق سهم ثبت‌شده هنگام صدور"}؛ سهم واحد از این دسته ${percent(categoryOwn, categoryTotal)}.`;
    return {
      title: e.description?.trim() || c.name,
      category: c.name,
      date:
        formatJalaliDate(e.expenseDate) +
        (e.coverageMonths && e.coverageMonths > 1
          ? ` · بازه قبض ${fa(String(e.coverageMonths))} ماه`
          : ""),
      buildingRial: e.amountRial,
      unitRial,
      funded,
      reason,
    };
  });
  const reasonByCategory = new Map<string, string>();
  costs.forEach((r, index) => {
    if (!costRows[index].funded)
      reasonByCategory.set(r.category.id, costRows[index].reason);
  });
  const assessments = ownLines.map((l) => ({
    title: l.categoryId === baseId ? "شارژ پایه دوره" : l.title,
    amountRial: l.amountRial,
    reason:
      l.categoryId === baseId
        ? `${fa(String(monthCount))} ماه × ${formatToman(l.amountRial / monthCount)}؛ سهم واحد از جمع شارژ ساختمان ${percent(baseNumerator, baseDenominator)}. شامل مخارج مشترک و ذخیره ساختمان است.`
        : (reasonByCategory.get(l.categoryId ?? "") ??
          l.basis ??
          "مبلغ ثبت‌شده در زمان صدور فیش"),
  }));
  const unexplained =
    invoice.totalRial - assessments.reduce((s, l) => s + l.amountRial, 0);
  if (fund && !ownLines.some((l) => l.categoryId === baseId))
    assessments.unshift({
      title: "شارژ پایه دوره",
      amountRial: 0,
      reason: "شارژ پایه این فیش صفر ثبت شده است.",
    });
  if (unexplained > 0)
    assessments.push({
      title: "سایر مبالغ ثبت‌شده فیش",
      amountRial: unexplained,
      reason:
        "جزئیات این مبلغ در سابقه قدیمی فیش موجود نیست؛ برای توضیح با مدیر هماهنگ کنید.",
    });
  const used = new Map<string | null, number>();
  for (const a of data.applications.filter(
    (a) => a.unitId === invoice.unitId && a.periodId === period.id,
  ))
    used.set(a.paymentId, (used.get(a.paymentId) ?? 0) + a.amountRial);
  const payments = [...used].map(([id, amountRial]) => {
    const source = data.payments.find((p) => p.payment.id === id)?.payment;
    return {
      title:
        source?.kind === "advance"
          ? "پرداخت مستقیم از طرف واحد"
          : source
            ? "واریز / اعتبار استفاده‌شده"
            : "بستانکاری اعمال‌شده",
      date: source ? formatJalaliDate(source.paidAt) : "ثبت در دفتر تسویه",
      amountRial,
    };
  });
  const legacy =
    invoice.paidRial - payments.reduce((s, p) => s + p.amountRial, 0);
  if (legacy > 0)
    payments.push({
      title: "تسویه ثبت‌شده در سابقه",
      date: "سابقه فیش",
      amountRial: legacy,
    });
  const notes: string[] = [];
  if (fund) {
    const usedFromBase = costRows
      .filter((r) => r.funded)
      .reduce((s, r) => s + r.unitRial, 0);
    notes.push(
      `از شارژ این واحد، ${formatToman(usedFromBase)} سهم محاسباتی مخارج مشترک ثبت‌شده است.`,
    );
    notes.push(
      base >= usedFromBase
        ? `تفاوت ${formatToman(base - usedFromBase)} برای بودجه و ذخیره ساختمان پس از وصول شارژ باقی می‌ماند؛ بستانکاری شخصی واحد نیست.`
        : `مخارج مشترک نسبت به شارژ واحد ${formatToman(usedFromBase - base)} کسری بودجه دارند؛ این کسری در مبلغ قابل پرداخت این فیش اضافه نشده است.`,
    );
    notes.push(
      "سهم محاسباتی ردیف‌های «از محل شارژ» فقط برای شفافیت است. در جمع نهایی، شارژ پایه یک‌بار و آب و هزینه‌های جداگانه به آن اضافه می‌شوند.",
    );
  }
  if (
    costRows.some((r) => r.unitRial % 10 !== 0) ||
    ownLines.some((l) => l.amountRial % 10 !== 0)
  )
    notes.push(
      "تفاوت جزئی اعشار سهم‌ها ناشی از تقسیم دقیق هزینه‌هاست؛ جمع سهم تمام واحدها با مبلغ هزینه برابر می‌ماند.",
    );
  const account = data.settlement.accounts.find(
    (a) => a.unitId === invoice.unitId,
  );
  const accountNotes: string[] = [];
  if ((account?.creditRial ?? 0) > 0)
    accountNotes.push(
      `بستانکاری آزاد حساب واحد: ${formatToman(account!.creditRial)}؛ تا زمان تخصیص مدیر، از مانده این فیش کم نمی‌شود.`,
    );
  const otherDebt = data.settlement.shares
    .filter(
      (s) =>
        s.unitId === invoice.unitId && s.periodId !== period.id && !s.draft,
    )
    .reduce((s, r) => s + r.balanceRial, 0);
  if (otherDebt > 0)
    accountNotes.push(
      `مانده سایر دوره‌ها: ${formatToman(otherDebt)}؛ در جمع این فیش محاسبه نشده است.`,
    );
  return {
    periodRange: `${formatJalaliDate(period.startDate)} تا ${formatJalaliDate(period.endDate)}`,
    occupancy: ownSnapshot
      ? `${ownSnapshot.temporarilyAbsent ? "غایب موقت" : ownSnapshot.status === "empty" ? "واحد خالی" : "واحد دارای ساکن"} · ${fa(String(present))} نفر حاضر · مبنا در زمان صدور`
      : "مبنای سهم‌ها مطابق اطلاعات ثبت‌شده هنگام صدور فیش است.",
    costRows,
    assessments,
    notes,
    payments,
    accountNotes,
  };
}

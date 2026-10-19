import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifyUnitAccounts } from "./notifications";
import {
  billingPeriod,
  building,
  expenseCategory,
  expenseLine,
  invoiceLineItem,
  payment,
  paymentApplication,
  unit,
  unitInvoice,
} from "@/lib/db/schema";
import {
  buildSettlementState,
  scopeKey,
  type CostShare,
  type SettlementData,
} from "./settlement-state";

export type LedgerTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];
type Reader = Pick<typeof db, "query" | "select">;

export async function loadSettlementData(
  reader: Reader,
  buildingId: string,
): Promise<SettlementData> {
  const [
    units,
    periods,
    categories,
    expenses,
    payments,
    invoices,
    lines,
    applications,
    settings,
  ] = await Promise.all([
    reader
      .select()
      .from(unit)
      .where(eq(unit.buildingId, buildingId))
      .orderBy(asc(unit.sortOrder), asc(unit.label)),
    reader
      .select()
      .from(billingPeriod)
      .where(
        and(
          eq(billingPeriod.buildingId, buildingId),
          isNull(billingPeriod.deletedAt),
        ),
      ),
    reader
      .select()
      .from(expenseCategory)
      .where(eq(expenseCategory.buildingId, buildingId))
      .orderBy(asc(expenseCategory.sortOrder)),
    reader
      .select({ row: expenseLine })
      .from(expenseLine)
      .innerJoin(billingPeriod, eq(expenseLine.periodId, billingPeriod.id))
      .where(
        and(
          eq(billingPeriod.buildingId, buildingId),
          isNull(billingPeriod.deletedAt),
          isNull(expenseLine.deletedAt),
        ),
      )
      .then((r) => r.map((v) => v.row)),
    reader
      .select()
      .from(payment)
      .where(and(eq(payment.buildingId, buildingId), isNull(payment.deletedAt)))
      .orderBy(asc(payment.createdAt), asc(payment.id)),
    reader
      .select({ row: unitInvoice })
      .from(unitInvoice)
      .innerJoin(billingPeriod, eq(unitInvoice.periodId, billingPeriod.id))
      .where(
        and(
          eq(billingPeriod.buildingId, buildingId),
          isNull(billingPeriod.deletedAt),
        ),
      )
      .then((r) => r.map((v) => v.row)),
    reader
      .select({ row: invoiceLineItem })
      .from(invoiceLineItem)
      .innerJoin(unitInvoice, eq(invoiceLineItem.invoiceId, unitInvoice.id))
      .innerJoin(billingPeriod, eq(unitInvoice.periodId, billingPeriod.id))
      .where(
        and(
          eq(billingPeriod.buildingId, buildingId),
          isNull(billingPeriod.deletedAt),
        ),
      )
      .then((r) => r.map((v) => v.row)),
    reader
      .select({ row: paymentApplication })
      .from(paymentApplication)
      .innerJoin(unit, eq(paymentApplication.unitId, unit.id))
      .where(eq(unit.buildingId, buildingId))
      .orderBy(asc(paymentApplication.createdAt), asc(paymentApplication.id))
      .then((r) => r.map((v) => v.row)),
    reader.query.building.findFirst({ where: eq(building.id, buildingId) }),
  ]);
  return {
    units,
    periods,
    categories,
    expenses,
    payments,
    invoices,
    lines,
    applications,
    settings,
  };
}

export async function syncInvoicePayments(
  tx: LedgerTransaction,
  buildingId: string,
) {
  const data = await loadSettlementData(tx, buildingId);
  for (const invoice of data.invoices) {
    const paid =
      invoice.legacyPaidRial +
      data.applications
        .filter(
          (a) => a.unitId === invoice.unitId && a.periodId === invoice.periodId,
        )
        .reduce((s, a) => s + a.amountRial, 0);
    if (paid > invoice.totalRial)
      throw new Error("مجموع تسویه از مبلغ فیش بیشتر شده است.");
    if (paid !== invoice.paidRial)
      await tx
        .update(unitInvoice)
        .set({ paidRial: paid, balanceRial: invoice.totalRial - paid })
        .where(eq(unitInvoice.id, invoice.id));
  }
}

/** Draft shares may change; money released from them remains the unit's credit. */
export async function reconcileDraftPayments(
  tx: LedgerTransaction,
  buildingId: string,
) {
  const data = await loadSettlementData(tx, buildingId);
  const state = buildSettlementState(data);
  const capacities = new Map(
    state.shares
      .filter((s) => s.draft)
      .map((s) => [scopeKey(s.unitId, s.periodId, s.categoryId), s.amountRial]),
  );
  for (const a of data.applications) {
    if (data.periods.find((p) => p.id === a.periodId)?.status !== "draft")
      continue;
    const key = scopeKey(a.unitId, a.periodId, a.categoryId);
    const capacity = capacities.get(key) ?? 0;
    const keep = Math.min(capacity, a.amountRial);
    capacities.set(key, capacity - keep);
    if (keep === 0)
      await tx
        .delete(paymentApplication)
        .where(eq(paymentApplication.id, a.id));
    else if (keep !== a.amountRial)
      await tx
        .update(paymentApplication)
        .set({ amountRial: keep })
        .where(eq(paymentApplication.id, a.id));
  }
}

async function applySource(
  tx: LedgerTransaction,
  sourceId: string | null,
  share: CostShare,
  amount: number,
) {
  if (amount <= 0) return;
  await tx.insert(paymentApplication).values({
    id: crypto.randomUUID(),
    paymentId: sourceId,
    unitId: share.unitId,
    periodId: share.periodId,
    categoryId: share.categoryId,
    amountRial: amount,
  });
}

export async function applyAvailableCredit(
  tx: LedgerTransaction,
  buildingId: string,
  unitId: string,
  targets: CostShare[],
  maxAmountRial?: number,
) {
  if (
    maxAmountRial !== undefined &&
    (!Number.isSafeInteger(maxAmountRial) || maxAmountRial <= 0)
  )
    throw new Error("مبلغ تخصیص باید بیشتر از صفر و معتبر باشد.");
  const data = await loadSettlementData(tx, buildingId);
  if (targets.some((s) => s.unitId !== unitId))
    throw new Error("اعتبار فقط برای همان واحد قابل استفاده است.");
  const fresh = buildSettlementState(data).shares;
  const distinct = new Map(
    targets.map((s) => [scopeKey(s.unitId, s.periodId, s.categoryId), s]),
  );
  const currentTargets = [...distinct.keys()]
    .map((key) =>
      fresh.find((s) => scopeKey(s.unitId, s.periodId, s.categoryId) === key),
    )
    .filter((s): s is CostShare => !!s);
  const apps = data.applications.filter((a) => a.unitId === unitId);
  const payments = data.payments.filter((p) => p.unitId === unitId);
  const legacy = Math.max(
    0,
    payments
      .filter((p) => !p.allocationTracked)
      .reduce((s, p) => s + p.amountRial, 0) -
      data.invoices
        .filter((i) => i.unitId === unitId)
        .reduce((s, i) => s + i.legacyPaidRial, 0) -
      apps
        .filter((a) => a.paymentId === null)
        .reduce((s, a) => s + a.amountRial, 0),
  );
  const sources = [
    { id: null as string | null, remaining: legacy },
    ...payments
      .filter((p) => p.allocationTracked)
      .map((p) => ({
        id: p.id,
        remaining:
          p.amountRial -
          apps
            .filter((a) => a.paymentId === p.id)
            .reduce((s, a) => s + a.amountRial, 0),
      })),
  ];
  let applied = 0;
  for (const target of currentTargets) {
    let due = target.balanceRial;
    for (const source of sources) {
      const use = Math.min(
        due,
        source.remaining,
        (maxAmountRial ?? Infinity) - applied,
      );
      if (use <= 0) continue;
      await applySource(tx, source.id, target, use);
      source.remaining -= use;
      due -= use;
      applied += use;
    }
  }
  await syncInvoicePayments(tx, buildingId);
  return applied;
}

export type ReceiptInput = {
  unitId: string;
  periodId?: string;
  categoryId?: string;
  receiptKey?: string;
  amountRial: number;
  method: "bank_transfer" | "cash" | "other";
  paidAt: Date;
  note?: string;
};
export async function insertUnitPayment(
  tx: LedgerTransaction,
  data: ReceiptInput,
  buildingId: string,
  userId?: string,
  existingId?: string,
) {
  if (!Number.isSafeInteger(data.amountRial) || data.amountRial <= 0)
    throw new Error("مبلغ واریز باید بیشتر از صفر باشد.");
  if (
    !["bank_transfer", "cash", "other"].includes(data.method) ||
    !Number.isFinite(data.paidAt.getTime())
  )
    throw new Error("اطلاعات واریز معتبر نیست.");
  if ((data.receiptKey?.length ?? 0) > 200 || (data.note?.length ?? 0) > 2000)
    throw new Error("توضیح یا شناسه دریافت بیش از حد طولانی است.");
  const loaded = await loadSettlementData(tx, buildingId);
  if (
    !loaded.units.some(
      (u) => u.id === data.unitId && (!u.deletedAt || existingId),
    )
  )
    throw new Error("واحد پیدا نشد.");
  if (data.receiptKey && !existingId) {
    const existing = await tx.query.payment.findFirst({
      where: eq(payment.receiptKey, data.receiptKey),
    });
    if (existing) {
      if (existing.deletedAt)
        throw new Error(
          "این دریافت قبلاً ابطال شده است؛ برای واریز تازه، فرم دریافت جدید را باز کنید.",
        );
      if (
        existing.buildingId !== buildingId ||
        existing.unitId !== data.unitId ||
        existing.amountRial !== data.amountRial ||
        existing.periodId !== (data.periodId ?? null) ||
        existing.categoryId !== (data.categoryId ?? null) ||
        existing.method !== data.method ||
        existing.paidAt.getTime() !== data.paidAt.getTime() ||
        (existing.note ?? "") !== (data.note ?? "")
      )
        throw new Error(
          "شناسه این دریافت قبلاً برای اطلاعات دیگری استفاده شده است.",
        );
      return existing.id;
    }
  }
  if (data.periodId && !loaded.periods.some((p) => p.id === data.periodId))
    throw new Error("دوره هزینه معتبر نیست.");
  if (
    data.categoryId &&
    (!data.periodId ||
      !loaded.categories.some(
        (c) => c.id === data.categoryId && c.allocationMethod !== "excluded",
      ))
  )
    throw new Error("هزینه انتخاب‌شده معتبر نیست.");
  await reconcileDraftPayments(tx, buildingId);
  const state = buildSettlementState(await loadSettlementData(tx, buildingId));
  const id = existingId ?? crypto.randomUUID();
  const values = {
    ...data,
    id,
    buildingId,
    recordedByUserId: userId ?? null,
    allocationTracked: true,
    deletedAt: null,
    periodId: data.periodId ?? null,
    categoryId: data.categoryId ?? null,
  };
  if (existingId)
    await tx
      .update(payment)
      .set(values)
      .where(and(eq(payment.id, id), eq(payment.buildingId, buildingId)));
  else await tx.insert(payment).values(values);
  let remaining = data.amountRial;
  const targets = state.shares.filter(
    (s) =>
      s.unitId === data.unitId &&
      (data.categoryId
        ? s.periodId === data.periodId && s.categoryId === data.categoryId
        : !s.draft),
  );
  if (!data.categoryId && data.periodId)
    targets.sort(
      (a, b) =>
        Number(b.periodId === data.periodId) -
        Number(a.periodId === data.periodId),
    );
  for (const target of targets) {
    const use = Math.min(remaining, target.balanceRial);
    await applySource(tx, id, target, use);
    remaining -= use;
  }
  await syncInvoicePayments(tx, buildingId);
  if (!existingId)
    await notifyUnitAccounts(
      tx,
      buildingId,
      [data.unitId],
      "واریز در حساب واحد ثبت شد",
      "مدیر یک دریافت در حساب واحد ثبت کرده است؛ سهم هزینه‌ها، بدهی و بستانکاری در حساب شما به‌روز شده‌اند.",
    );
  return id;
}

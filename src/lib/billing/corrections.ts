import { and, eq } from "drizzle-orm";
import {
  billingPeriod,
  expenseLine,
  invoiceLineItem,
  managementEvent,
  payment,
  paymentApplication,
  paymentRequest,
  periodSnapshot,
  unitInvoice,
  standaloneExpense,
} from "@/lib/db/schema";
import {
  insertUnitPayment,
  loadSettlementData,
  reconcileDraftPayments,
  syncInvoicePayments,
  type LedgerTransaction,
  type ReceiptInput,
} from "./settlement-store";
import { buildSettlementState, scopeKey } from "./settlement-state";
import { validateMaintenanceLink } from "./maintenance-link";
import { notifyUnitAccounts } from "./notifications";
import { parseUtilityBill, type UtilityBill } from "./utility-bill";
import { isoDate } from "@/lib/format/jalali";
import { assertCostHasNoDisbursements } from "./disbursements";

export function periodCalculationChanged(
  before: { startDate: Date; endDate: Date; periodType: string },
  after: { startDate: Date; endDate: Date; periodType: string },
) {
  return (
    isoDate(before.startDate) !== isoDate(after.startDate) ||
    isoDate(before.endDate) !== isoDate(after.endDate) ||
    before.periodType !== after.periodType
  );
}

export type RecoverableEntity =
  | "payment"
  | "period"
  | "expense"
  | "unit"
  | "category"
  | "maintenance"
  | "request";

export async function logManagementEvent(
  tx: LedgerTransaction,
  buildingId: string,
  actorId: string | undefined,
  entityType: string,
  entityId: string,
  action: string,
  label: string,
  before?: unknown,
  after?: unknown,
) {
  await tx.insert(managementEvent).values({
    id: crypto.randomUUID(),
    buildingId,
    actorId,
    entityType,
    entityId,
    action,
    label,
    beforeJson: before === undefined ? null : JSON.stringify(before),
    afterJson: after === undefined ? null : JSON.stringify(after),
  });
}

/** Resolve the old aggregate settlements to actual cash sources before a correction.
 * The original per-category paid amounts, invoice balances and free credit stay equal.
 */
export async function materializeLegacyPayments(
  tx: LedgerTransaction,
  buildingId: string,
) {
  const data = await loadSettlementData(tx, buildingId);
  if (
    !data.payments.some((p) => !p.allocationTracked) &&
    !data.invoices.some((i) => i.legacyPaidRial > 0) &&
    !data.applications.some((a) => a.paymentId === null)
  )
    return;
  const state = buildSettlementState(data);
  for (const u of data.units) {
    const legacyPayments = data.payments
      .filter((p) => p.unitId === u.id && !p.allocationTracked)
      .sort(
        (a, b) =>
          a.paidAt.getTime() - b.paidAt.getTime() ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
    const sources = legacyPayments.map((p) => ({
      id: p.id,
      left:
        p.amountRial -
        data.applications
          .filter((a) => a.paymentId === p.id)
          .reduce((s, a) => s + a.amountRial, 0),
    }));
    async function fund(
      periodId: string,
      categoryId: string | null,
      amountRial: number,
    ) {
      let left = amountRial;
      for (const source of sources) {
        const use = Math.min(left, source.left);
        if (use <= 0) continue;
        await tx.insert(paymentApplication).values({
          id: crypto.randomUUID(),
          paymentId: source.id,
          unitId: u.id,
          periodId,
          categoryId,
          amountRial: use,
        });
        source.left -= use;
        left -= use;
      }
      if (left > 0)
        throw new Error(
          "تسویه قدیمی با دریافت‌های این واحد سازگار نیست؛ تغییری ثبت نشد.",
        );
    }
    for (const share of state.shares.filter(
      (s) => s.unitId === u.id && !s.draft,
    )) {
      const apps = data.applications.filter(
        (a) =>
          scopeKey(a.unitId, a.periodId, a.categoryId) ===
          scopeKey(u.id, share.periodId, share.categoryId),
      );
      const baseline =
        share.paidRial - apps.reduce((s, a) => s + a.amountRial, 0);
      if (baseline > 0) await fund(share.periodId, share.categoryId, baseline);
    }
    for (const app of data.applications.filter(
      (a) => a.unitId === u.id && a.paymentId === null,
    )) {
      await fund(app.periodId, app.categoryId, app.amountRial);
      await tx
        .delete(paymentApplication)
        .where(eq(paymentApplication.id, app.id));
    }
    for (const p of legacyPayments)
      await tx
        .update(payment)
        .set({ allocationTracked: true })
        .where(eq(payment.id, p.id));
    for (const invoice of data.invoices.filter(
      (i) => i.unitId === u.id && i.legacyPaidRial > 0,
    ))
      await tx
        .update(unitInvoice)
        .set({ legacyPaidRial: 0 })
        .where(eq(unitInvoice.id, invoice.id));
  }
  await syncInvoicePayments(tx, buildingId);
}

/** Release an exact allocation amount; the original cash receipts remain intact. */
export async function releaseCostApplications(
  tx: LedgerTransaction,
  buildingId: string,
  scope: {
    unitId: string;
    periodId: string;
    categoryId: string | null;
    amountRial?: number;
  },
) {
  const ledger = await loadSettlementData(tx, buildingId);
  if (
    !ledger.units.some((u) => u.id === scope.unitId) ||
    !ledger.periods.some((p) => p.id === scope.periodId)
  )
    throw new Error("هزینه پیدا نشد.");
  await materializeLegacyPayments(tx, buildingId);
  const current = await loadSettlementData(tx, buildingId);
  const applications = current.applications.filter(
    (a) =>
      a.unitId === scope.unitId &&
      a.periodId === scope.periodId &&
      a.categoryId === scope.categoryId,
  );
  const paid = applications.reduce((s, a) => s + a.amountRial, 0);
  const amountRial = scope.amountRial ?? paid;
  if (!Number.isSafeInteger(amountRial) || amountRial <= 0 || amountRial > paid)
    throw new Error(
      "مبلغ برگشت باید بیشتر از صفر و حداکثر برابر مبلغ تسویه‌شده باشد.",
    );
  let remaining = amountRial;
  // Release the newest applications first, retaining each receipt's provenance.
  for (const application of [...applications].reverse()) {
    const released = Math.min(remaining, application.amountRial);
    if (!released) break;
    if (released === application.amountRial)
      await tx
        .delete(paymentApplication)
        .where(eq(paymentApplication.id, application.id));
    else
      await tx
        .update(paymentApplication)
        .set({ amountRial: application.amountRial - released })
        .where(eq(paymentApplication.id, application.id));
    remaining -= released;
  }
  await syncInvoicePayments(tx, buildingId);
  return { applications, amountRial };
}

export async function correctReceipt(
  tx: LedgerTransaction,
  buildingId: string,
  id: string,
  operation: "edit" | "delete" | "restore",
  actorId?: string,
  input?: ReceiptInput,
) {
  const original = await tx.query.payment.findFirst({
    where: and(eq(payment.id, id), eq(payment.buildingId, buildingId)),
  });
  if (!original) throw new Error("واریز پیدا نشد.");
  if (input && original.standaloneExpenseId)
    input = {
      ...input,
      standaloneExpenseId: original.standaloneExpenseId,
      kind: input.kind ?? original.kind,
    };
  if (operation === "restore" ? !original.deletedAt : !!original.deletedAt)
    throw new Error("وضعیت این واریز تغییر کرده است؛ صفحه را تازه کنید.");
  const metadataOnly =
    operation === "edit" &&
    input &&
    input.unitId === original.unitId &&
    input.amountRial === original.amountRial &&
    (input.kind ?? "receipt") === original.kind &&
    (input.categoryId ?? null) === original.categoryId &&
    (!original.categoryId || (input.periodId ?? null) === original.periodId);
  if (metadataOnly && input) {
    if (
      !["bank_transfer", "cash", "other"].includes(input.method) ||
      !Number.isFinite(input.paidAt.getTime()) ||
      (input.note?.length ?? 0) > 2000
    )
      throw new Error("اطلاعات واریز معتبر نیست.");
    const values = {
      method: input.method,
      paidAt: input.paidAt,
      note: input.note ?? null,
    };
    await tx.update(payment).set(values).where(eq(payment.id, id));
    await logManagementEvent(
      tx,
      buildingId,
      actorId,
      "payment",
      id,
      "edit",
      "اصلاح مشخصات واریز",
      original,
      { ...original, ...values },
    );
    return;
  }
  if (operation === "restore" && original.receiptKey?.startsWith("request:")) {
    const prefix = original.receiptKey.split(":").slice(0, 2).join(":");
    const active = (await loadSettlementData(tx, buildingId)).payments.some(
      (p) =>
        p.id !== id &&
        (p.receiptKey === prefix || p.receiptKey?.startsWith(`${prefix}:`)),
    );
    if (active)
      throw new Error(
        "این اعلام واریز دوباره تأیید و دریافتش ثبت شده است؛ دریافت فعال را ویرایش کنید تا مبلغ دوبار ثبت نشود.",
      );
  }
  await materializeLegacyPayments(tx, buildingId);
  const applications = await tx
    .select()
    .from(paymentApplication)
    .where(eq(paymentApplication.paymentId, id));
  await tx
    .delete(paymentApplication)
    .where(eq(paymentApplication.paymentId, id));
  if (operation === "delete") {
    await tx
      .update(payment)
      .set({ deletedAt: new Date() })
      .where(eq(payment.id, id));
    // A voided approved report must never remain labelled as money received.
    const requestId = original.receiptKey?.startsWith("request:")
      ? original.receiptKey.split(":")[1]
      : undefined;
    if (requestId)
      await tx
        .update(paymentRequest)
        .set({ status: "rejected" })
        .where(eq(paymentRequest.id, requestId));
  } else {
    const data = input ?? {
      unitId: original.unitId,
      periodId: original.periodId ?? undefined,
      categoryId: original.categoryId ?? undefined,
      amountRial: original.amountRial,
      method: original.method,
      paidAt: original.paidAt,
      note: original.note ?? undefined,
      standaloneExpenseId: original.standaloneExpenseId ?? undefined,
      kind: original.kind,
    };
    // A cost/period may have been removed since this receipt was voided. Restore the
    // real cash as free credit, rather than silently paying unrelated old debts.
    const ledger = await loadSettlementData(tx, buildingId);
    const missingPurpose =
      (data.periodId && !ledger.periods.some((p) => p.id === data.periodId)) ||
      (data.categoryId &&
        !buildSettlementState(ledger).shares.some(
          (s) =>
            s.unitId === data.unitId &&
            s.periodId === data.periodId &&
            s.categoryId === data.categoryId,
        ));
    if (missingPurpose && operation === "restore") {
      if (!ledger.units.some((u) => u.id === data.unitId))
        throw new Error("واحد پیدا نشد.");
      await tx
        .update(payment)
        .set({ deletedAt: null, allocationTracked: true })
        .where(eq(payment.id, id));
    } else {
      await insertUnitPayment(
        tx,
        data,
        buildingId,
        original.recordedByUserId ?? actorId,
        id,
      );
    }
    const requestId = original.receiptKey?.startsWith("request:")
      ? original.receiptKey.split(":")[1]
      : undefined;
    if (requestId && data.unitId !== original.unitId)
      await tx
        .update(payment)
        .set({ receiptKey: `corrected:${id}:${original.receiptKey}` })
        .where(eq(payment.id, id));
    if (requestId)
      await tx
        .update(paymentRequest)
        .set({
          status: data.unitId === original.unitId ? "approved" : "rejected",
        })
        .where(eq(paymentRequest.id, requestId));
  }
  await syncInvoicePayments(tx, buildingId);
  const after = await tx.query.payment.findFirst({ where: eq(payment.id, id) });
  await notifyUnitAccounts(
    tx,
    buildingId,
    [original.unitId, ...(after ? [after.unitId] : [])],
    "حساب واحد به‌روز شد",
    operation === "delete"
      ? "مدیر یک واریز را ابطال کرده است؛ مانده بدهی و بستانکاری دوباره محاسبه شد."
      : "مدیر یک واریز را اصلاح یا بازیابی کرده است؛ مبلغ و وضعیت فعلی را در حساب واحد بررسی کنید.",
    "payment",
    "/resident/payments",
  );
  await logManagementEvent(
    tx,
    buildingId,
    actorId,
    "payment",
    id,
    operation,
    "واریز واحد",
    { ...original, applications },
    after,
  );
}

/** Revoke generated bills, keep real cash and its earmarks, then expose a draft.
 * All revoked bill lines and occupancy snapshots remain in the correction journal.
 */
export async function reopenPeriod(
  tx: LedgerTransaction,
  buildingId: string,
  id: string,
  actorId?: string,
) {
  const period = await tx.query.billingPeriod.findFirst({
    where: and(
      eq(billingPeriod.id, id),
      eq(billingPeriod.buildingId, buildingId),
    ),
  });
  if (!period || period.deletedAt) throw new Error("دوره پیدا نشد.");
  if (period.status === "draft") return;
  await materializeLegacyPayments(tx, buildingId);
  const ledger = await loadSettlementData(tx, buildingId);
  const invoices = ledger.invoices.filter((i) => i.periodId === id);
  const lines = ledger.lines.filter((l) =>
    invoices.some((i) => i.id === l.invoiceId),
  );
  const snapshots = await tx
    .select()
    .from(periodSnapshot)
    .where(eq(periodSnapshot.periodId, id));
  await logManagementEvent(
    tx,
    buildingId,
    actorId,
    "period",
    id,
    "reopen",
    period.title,
    { period, invoices, lines, snapshots },
  );
  for (const invoice of invoices) {
    await tx
      .delete(invoiceLineItem)
      .where(eq(invoiceLineItem.invoiceId, invoice.id));
    await tx.delete(unitInvoice).where(eq(unitInvoice.id, invoice.id));
  }
  await tx.delete(periodSnapshot).where(eq(periodSnapshot.periodId, id));
  await notifyUnitAccounts(
    tx,
    buildingId,
    invoices.map((i) => i.unitId),
    "بازنگری فیش دوره",
    `فیش «${period.title}» برای اصلاح از اعتبار خارج شد. واریزهای شما حفظ شده‌اند؛ پس از صدور دوباره، فیش جدید نمایش داده می‌شود.`,
    "invoice",
  );
  await tx
    .update(billingPeriod)
    .set({ status: "draft", finalizedAt: null })
    .where(eq(billingPeriod.id, id));
  await reconcileDraftPayments(tx, buildingId);
}

export async function removePeriod(
  tx: LedgerTransaction,
  buildingId: string,
  id: string,
  actorId?: string,
) {
  await assertCostHasNoDisbursements(tx, buildingId, { periodId: id });
  await reopenPeriod(tx, buildingId, id, actorId);
  const period = await tx.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, id),
  });
  // A removed billing period must return its independent costs to the holding book.
  const costs = await tx
    .select()
    .from(standaloneExpense)
    .where(eq(standaloneExpense.buildingId, buildingId));
  for (const cost of costs) {
    if (!cost.linkedExpenseId) continue;
    const line = await tx.query.expenseLine.findFirst({
      where: eq(expenseLine.id, cost.linkedExpenseId),
    });
    if (line?.periodId !== id) continue;
    const receipts = await tx
      .select()
      .from(payment)
      .where(eq(payment.standaloneExpenseId, cost.id));
    for (const receipt of receipts)
      await tx
        .delete(paymentApplication)
        .where(eq(paymentApplication.paymentId, receipt.id));
    await tx
      .update(payment)
      .set({ periodId: null, categoryId: null })
      .where(eq(payment.standaloneExpenseId, cost.id));
    await tx
      .update(expenseLine)
      .set({ deletedAt: new Date() })
      .where(eq(expenseLine.id, line.id));
    await tx
      .update(standaloneExpense)
      .set({ linkedExpenseId: null })
      .where(eq(standaloneExpense.id, cost.id));
  }
  await tx
    .delete(paymentApplication)
    .where(eq(paymentApplication.periodId, id));
  await tx
    .update(billingPeriod)
    .set({ deletedAt: new Date() })
    .where(eq(billingPeriod.id, id));
  await logManagementEvent(
    tx,
    buildingId,
    actorId,
    "period",
    id,
    "delete",
    period!.title,
    period,
  );
  await syncInvoicePayments(tx, buildingId);
}

export async function correctExpense(
  tx: LedgerTransaction,
  buildingId: string,
  id: string,
  operation: "edit" | "delete" | "restore",
  actorId?: string,
  input?: {
    utilityBill?: UtilityBill | null;
    billingTreatment?: "auto" | "separate";
    coverageMonths?: number | null;
    categoryId: string;
    amountRial: number;
    description: string;
    expenseDate: Date;
    maintenanceTicketId?: string | null;
  },
  allowStandalone = false,
) {
  const expense = await tx.query.expenseLine.findFirst({
    where: eq(expenseLine.id, id),
  });
  if (!expense) throw new Error("هزینه پیدا نشد.");
  const source = await tx.query.standaloneExpense.findFirst({
    where: eq(standaloneExpense.linkedExpenseId, id),
  });
  if (!allowStandalone && (source || expense.sourceStandaloneId))
    throw new Error(
      "این هزینه از دفتر مستقل آمده است؛ مدیریت و بازیابی را از پرونده هزینه مستقل انجام دهید.",
    );
  const period = await tx.query.billingPeriod.findFirst({
    where: and(
      eq(billingPeriod.id, expense.periodId),
      eq(billingPeriod.buildingId, buildingId),
    ),
  });
  if (!period || period.deletedAt)
    throw new Error("ابتدا دوره این هزینه را بازیابی کنید.");
  if (operation === "delete")
    await assertCostHasNoDisbursements(tx, buildingId, { expenseId: id });
  if (operation === "restore" ? !expense.deletedAt : !!expense.deletedAt)
    throw new Error("وضعیت هزینه تغییر کرده است؛ صفحه را تازه کنید.");
  if (input) {
    await validateMaintenanceLink(
      tx,
      buildingId,
      input.maintenanceTicketId,
      expense.maintenanceTicketId,
    );
    const category = await tx.query.expenseCategory.findFirst({
      where: (c, { and, eq }) =>
        and(eq(c.id, input.categoryId), eq(c.buildingId, buildingId)),
    });
    if (
      (input.coverageMonths != null &&
        (!Number.isInteger(input.coverageMonths) ||
          input.coverageMonths < 1 ||
          input.coverageMonths > 36)) ||
      !category ||
      (!category.active && category.id !== expense.categoryId) ||
      category.allocationMethod === "excluded" ||
      !Number.isSafeInteger(input.amountRial) ||
      input.amountRial <= 0 ||
      !Number.isFinite(input.expenseDate.getTime()) ||
      input.description.length > 2000 ||
      (input.billingTreatment !== undefined &&
        !["auto", "separate"].includes(input.billingTreatment))
    )
      throw new Error("اطلاعات هزینه معتبر نیست.");
  }
  if (
    operation !== "edit" ||
    !input ||
    input.amountRial !== expense.amountRial ||
    input.categoryId !== expense.categoryId ||
    (input.billingTreatment !== undefined &&
      input.billingTreatment !== expense.billingTreatment)
  )
    await reopenPeriod(tx, buildingId, period.id, actorId);
  await tx
    .update(expenseLine)
    .set({
      ...input,
      utilityBill:
        input?.utilityBill === undefined
          ? expense.utilityBill
          : parseUtilityBill(input.utilityBill),
      deletedAt: operation === "delete" ? new Date() : null,
    })
    .where(eq(expenseLine.id, id));
  await reconcileDraftPayments(tx, buildingId);
  await logManagementEvent(
    tx,
    buildingId,
    actorId,
    "expense",
    id,
    operation,
    expense.description || "هزینه ساختمان",
    expense,
    input,
  );
}

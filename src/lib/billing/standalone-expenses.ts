import { and, eq, isNull } from "drizzle-orm";
import {
  billingPeriod,
  expenseCategory,
  expenseLine,
  payment,
  paymentApplication,
  standaloneExpense,
} from "@/lib/db/schema";
import { buildSettlementState } from "./settlement-state";
import {
  loadSettlementData,
  reconcileDraftPayments,
  syncInvoicePayments,
  type LedgerTransaction,
} from "./settlement-store";
import { correctExpense, logManagementEvent } from "./corrections";
import { validateMaintenanceLink } from "./maintenance-link";
import { paymentDestination } from "./charge-model";
import { assertCostHasNoDisbursements } from "./disbursements";
import { parseUtilityBill, type UtilityBill } from "./utility-bill";

export type StandaloneInput = {
  categoryId: string;
  amountRial: number;
  description: string;
  expenseDate: Date;
  maintenanceTicketId?: string | null;
  utilityBill?: UtilityBill | null;
};
async function owned(tx: LedgerTransaction, buildingId: string, id: string) {
  const cost = await tx.query.standaloneExpense.findFirst({
    where: and(
      eq(standaloneExpense.id, id),
      eq(standaloneExpense.buildingId, buildingId),
    ),
  });
  if (!cost) throw new Error("هزینه مستقل پیدا نشد.");
  return cost;
}
export async function saveStandaloneCost(
  tx: LedgerTransaction,
  buildingId: string,
  input: StandaloneInput,
  actorId?: string,
  id?: string,
) {
  const before = id ? await owned(tx, buildingId, id) : null;
  if (before?.deletedAt || before?.linkedExpenseId)
    throw new Error("ابتدا هزینه را از دوره خارج یا بازیابی کنید.");
  const category = await tx.query.expenseCategory.findFirst({
    where: and(
      eq(expenseCategory.id, input.categoryId),
      eq(expenseCategory.buildingId, buildingId),
    ),
  });
  if (
    !category ||
    (!category.active && category.id !== before?.categoryId) ||
    category.allocationMethod === "excluded"
  )
    throw new Error("دسته هزینه معتبر نیست.");
  if (
    !input.description.trim() ||
    input.description.length > 2000 ||
    !Number.isSafeInteger(input.amountRial) ||
    input.amountRial <= 0 ||
    !Number.isFinite(input.expenseDate.getTime())
  )
    throw new Error("شرح، مبلغ و تاریخ هزینه را درست وارد کنید.");
  await validateMaintenanceLink(
    tx,
    buildingId,
    input.maintenanceTicketId,
    before?.maintenanceTicketId,
  );
  if (id) {
    const advances = await tx
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.standaloneExpenseId, id),
          eq(payment.kind, "advance"),
          isNull(payment.deletedAt),
        ),
      );
    if (advances.reduce((s, p) => s + p.amountRial, 0) > input.amountRial)
      throw new Error(
        "مبلغ هزینه از پرداخت مستقیم ثبت‌شده کمتر است؛ ابتدا پرداخت اشتباه را اصلاح کنید.",
      );
  }
  const key = id ?? crypto.randomUUID();
  const values = {
    ...input,
    utilityBill:
      input.utilityBill === undefined
        ? (before?.utilityBill ?? null)
        : parseUtilityBill(input.utilityBill),
    description: input.description.trim(),
    maintenanceTicketId: input.maintenanceTicketId ?? null,
  };
  if (id)
    await tx
      .update(standaloneExpense)
      .set(values)
      .where(eq(standaloneExpense.id, id));
  else
    await tx
      .insert(standaloneExpense)
      .values({ ...values, id: key, buildingId });
  await logManagementEvent(
    tx,
    buildingId,
    actorId,
    "standalone_expense",
    key,
    id ? "edit" : "create",
    values.description,
    before,
    values,
  );
  return key;
}

export async function includeStandaloneCost(
  tx: LedgerTransaction,
  buildingId: string,
  id: string,
  periodId: string,
  actorId?: string,
  billingTreatment: "auto" | "separate" = "auto",
) {
  const cost = await owned(tx, buildingId, id);
  if (!["auto", "separate"].includes(billingTreatment))
    throw new Error("روش تأمین معتبر نیست.");
  if (cost.deletedAt || cost.linkedExpenseId)
    throw new Error("این هزینه حذف شده یا قبلاً به دوره منتقل شده است.");
  const period = await tx.query.billingPeriod.findFirst({
    where: and(
      eq(billingPeriod.id, periodId),
      eq(billingPeriod.buildingId, buildingId),
      isNull(billingPeriod.deletedAt),
    ),
  });
  if (!period || period.status !== "draft")
    throw new Error("یک دوره باز از همین ساختمان انتخاب کنید.");
  const category = await tx.query.expenseCategory.findFirst({
    where: and(
      eq(expenseCategory.id, cost.categoryId),
      eq(expenseCategory.buildingId, buildingId),
    ),
  });
  if (
    !category ||
    category.allocationMethod === "excluded" ||
    category.allocationMethod === "fixed_per_unit"
  )
    throw new Error(
      "برای انتقال هزینه واقعی، دسته‌ای با تقسیم بر واحد یا نفرات انتخاب کنید؛ دسته شارژ ثابت مناسب نیست.",
    );
  const lineId = crypto.randomUUID();
  await tx.insert(expenseLine).values({
    id: lineId,
    sourceStandaloneId: id,
    billingTreatment,
    periodId,
    categoryId: cost.categoryId,
    amountRial: cost.amountRial,
    description: cost.description,
    expenseDate: cost.expenseDate,
    utilityBill: cost.utilityBill,
    maintenanceTicketId: cost.maintenanceTicketId,
  });
  await tx
    .update(standaloneExpense)
    .set({ linkedExpenseId: lineId })
    .where(eq(standaloneExpense.id, id));
  await tx
    .update(payment)
    .set({ periodId, categoryId: cost.categoryId })
    .where(eq(payment.standaloneExpenseId, id));
  await reconcileDraftPayments(tx, buildingId);
  const receipts = (await loadSettlementData(tx, buildingId)).payments.filter(
    (p) => p.standaloneExpenseId === id,
  );
  // Consume only this cost's sources, so unrelated credit is never spent implicitly.
  for (const receipt of receipts) {
    const ledger = await loadSettlementData(tx, buildingId);
    const state = buildSettlementState(ledger);
    const destination = paymentDestination(ledger, receipt);
    const share = state.shares.find(
      (s) =>
        s.unitId === receipt.unitId &&
        s.periodId === periodId &&
        s.categoryId === destination,
    );
    const amountRial = Math.min(receipt.amountRial, share?.balanceRial ?? 0);
    if (amountRial > 0)
      await tx.insert(paymentApplication).values({
        id: crypto.randomUUID(),
        paymentId: receipt.id,
        unitId: receipt.unitId,
        periodId,
        categoryId: destination ?? null,
        amountRial,
      });
  }
  await syncInvoicePayments(tx, buildingId);
  await logManagementEvent(
    tx,
    buildingId,
    actorId,
    "standalone_expense",
    id,
    "include",
    cost.description,
    cost,
    { periodId, linkedExpenseId: lineId },
  );
}

export async function detachStandaloneCost(
  tx: LedgerTransaction,
  buildingId: string,
  id: string,
  actorId?: string,
) {
  const cost = await owned(tx, buildingId, id);
  if (cost.deletedAt || !cost.linkedExpenseId)
    throw new Error("این هزینه در دوره‌ای قرار ندارد.");
  const lineId = cost.linkedExpenseId;
  const receipts = await tx
    .select()
    .from(payment)
    .where(eq(payment.standaloneExpenseId, id));
  for (const receipt of receipts)
    await tx
      .delete(paymentApplication)
      .where(eq(paymentApplication.paymentId, receipt.id));
  await tx
    .update(payment)
    .set({ periodId: null, categoryId: null })
    .where(eq(payment.standaloneExpenseId, id));
  await tx
    .update(standaloneExpense)
    .set({ linkedExpenseId: null })
    .where(eq(standaloneExpense.id, id));
  await correctExpense(
    tx,
    buildingId,
    lineId,
    "delete",
    actorId,
    undefined,
    true,
  );
  await syncInvoicePayments(tx, buildingId);
  await logManagementEvent(
    tx,
    buildingId,
    actorId,
    "standalone_expense",
    id,
    "detach",
    cost.description,
    cost,
  );
}

export async function setStandaloneCostDeleted(
  tx: LedgerTransaction,
  buildingId: string,
  id: string,
  deleted: boolean,
  actorId?: string,
) {
  const cost = await owned(tx, buildingId, id);
  if (deleted === !!cost.deletedAt)
    throw new Error("وضعیت هزینه تغییر کرده است؛ صفحه را تازه کنید.");
  if (cost.linkedExpenseId)
    throw new Error("ابتدا این هزینه را از دوره خارج کنید.");
  if (deleted) {
    await assertCostHasNoDisbursements(tx, buildingId, {
      standaloneExpenseId: id,
    });
    const active = await tx.query.payment.findFirst({
      where: and(
        eq(payment.standaloneExpenseId, id),
        isNull(payment.deletedAt),
      ),
    });
    if (active)
      throw new Error(
        "این هزینه پرداخت فعال دارد؛ ابتدا ثبت‌های اشتباه را ابطال کنید. حذف هزینه به‌معنی برگشت وجه نیست.",
      );
  }
  await tx
    .update(standaloneExpense)
    .set({ deletedAt: deleted ? new Date() : null })
    .where(eq(standaloneExpense.id, id));
  await logManagementEvent(
    tx,
    buildingId,
    actorId,
    "standalone_expense",
    id,
    deleted ? "delete" : "restore",
    cost.description,
    cost,
  );
}

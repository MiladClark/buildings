import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { expenseDisbursement, expenseLine } from "@/lib/db/schema";
import { logManagementEvent } from "./corrections";
import { loadSettlementData, type LedgerTransaction } from "./settlement-store";
import { buildTreasury } from "./treasury";

const inputSchema = z
  .object({
    id: z.string().uuid(),
    expenseId: z.string().min(1).optional(),
    standaloneExpenseId: z.string().min(1).optional(),
    amountRial: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    payee: z.string().trim().min(1).max(200),
    paidAt: z.date(),
    method: z.enum(["bank_transfer", "cash", "other"]),
    reference: z.string().trim().max(200).default(""),
    note: z.string().trim().max(2000).default(""),
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(200),
          amountRial: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        }),
      )
      .max(100),
    finalPayment: z.boolean(),
  })
  .refine(
    (v) => !!v.expenseId !== !!v.standaloneExpenseId,
    "یک هزینه انتخاب کنید.",
  )
  .refine(
    (v) =>
      !v.items.length ||
      v.items.reduce((s, i) => s + i.amountRial, 0) === v.amountRial,
    "جمع ریز خرید با مبلغ پرداخت برابر نیست.",
  );
export type DisbursementInput = z.input<typeof inputSchema>;

export async function recordDisbursement(
  tx: LedgerTransaction,
  buildingId: string,
  input: DisbursementInput,
  actorId?: string,
) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      "مبلغ، گیرنده، تاریخ و ریز خرید را درست وارد کنید؛ جمع ریز خرید باید برابر پرداخت باشد.",
    );
  const v = parsed.data;
  const existing = await tx.query.expenseDisbursement.findFirst({
    where: eq(expenseDisbursement.id, v.id),
  });
  if (existing) {
    if (
      existing.buildingId !== buildingId ||
      existing.cancelledAt ||
      existing.amountRial !== v.amountRial ||
      existing.expenseId !== (v.expenseId ?? null) ||
      existing.standaloneExpenseId !== (v.standaloneExpenseId ?? null) ||
      existing.payee !== v.payee ||
      existing.paidAt.getTime() !== v.paidAt.getTime() ||
      existing.method !== v.method ||
      (existing.reference ?? "") !== v.reference ||
      (existing.note ?? "") !== v.note ||
      existing.finalPayment !== v.finalPayment ||
      existing.items.length !== v.items.length ||
      existing.items.some(
        (item, index) =>
          item.description !== v.items[index].description ||
          item.amountRial !== v.items[index].amountRial,
      )
    )
      throw new Error(
        "شناسه پرداخت قبلاً استفاده شده است؛ فرم را دوباره باز کنید.",
      );
    return existing.id;
  }
  const ledger = await loadSettlementData(tx, buildingId);
  const history = await tx
    .select()
    .from(expenseDisbursement)
    .where(eq(expenseDisbursement.buildingId, buildingId));
  const treasury = buildTreasury(ledger, history);
  const cost = treasury.costs.find((c) =>
    v.standaloneExpenseId
      ? c.target.standaloneExpenseId === v.standaloneExpenseId
      : c.target.expenseId === v.expenseId,
  );
  if (!cost)
    throw new Error(
      "هزینه فعال در این ساختمان پیدا نشد؛ برای هزینه منتقل‌شده، پرونده مستقل را باز کنید.",
    );
  if (cost.settled)
    throw new Error(
      "این هزینه تسویه شده است؛ برای اصلاح، ابتدا پرداخت نهایی اشتباه را لغو کنید.",
    );
  await tx
    .insert(expenseDisbursement)
    .values({ ...v, buildingId, recordedByUserId: actorId });
  await logManagementEvent(
    tx,
    buildingId,
    actorId,
    "disbursement",
    v.id,
    "create",
    cost.title,
    undefined,
    v,
  );
  return v.id;
}

export async function cancelDisbursement(
  tx: LedgerTransaction,
  buildingId: string,
  id: string,
  reason: string,
  actorId?: string,
) {
  if (typeof reason !== "string" || !reason.trim() || reason.length > 2000)
    throw new Error("دلیل لغو پرداخت را بنویسید.");
  const before = await tx.query.expenseDisbursement.findFirst({
    where: and(
      eq(expenseDisbursement.id, id),
      eq(expenseDisbursement.buildingId, buildingId),
    ),
  });
  if (!before) throw new Error("پرداخت پیدا نشد.");
  if (before.cancelledAt) throw new Error("این پرداخت قبلاً لغو شده است.");
  const after = { cancelledAt: new Date(), cancellationReason: reason.trim() };
  await tx
    .update(expenseDisbursement)
    .set(after)
    .where(eq(expenseDisbursement.id, id));
  await logManagementEvent(
    tx,
    buildingId,
    actorId,
    "disbursement",
    id,
    "cancel",
    before.payee,
    before,
    after,
  );
}

export async function assertCostHasNoDisbursements(
  tx: LedgerTransaction,
  buildingId: string,
  target: {
    expenseId?: string;
    standaloneExpenseId?: string;
    periodId?: string;
  },
) {
  const records = await tx
    .select()
    .from(expenseDisbursement)
    .where(
      and(
        eq(expenseDisbursement.buildingId, buildingId),
        isNull(expenseDisbursement.cancelledAt),
      ),
    );
  const periodLines = target.periodId
    ? await tx
        .select()
        .from(expenseLine)
        .where(eq(expenseLine.periodId, target.periodId))
    : [];
  if (
    records.some(
      (d) =>
        (target.expenseId && d.expenseId === target.expenseId) ||
        (target.standaloneExpenseId &&
          d.standaloneExpenseId === target.standaloneExpenseId) ||
        periodLines.some((e) => e.id === d.expenseId),
    )
  )
    throw new Error(
      "این هزینه پرداخت از حساب دارد؛ ابتدا پرداخت اشتباه را لغو کنید. حذف هزینه نباید سابقه خرج‌کرد حساب را پنهان کند.",
    );
}

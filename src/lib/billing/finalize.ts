import { and, eq, isNull } from "drizzle-orm";
import { allocatePeriodCharges } from "@/lib/billing/engine";
import { receivableExpenses, usesChargeFund } from "./charge-model";
import {
  applyAvailableCredit,
  loadSettlementData,
  reconcileDraftPayments,
  syncInvoicePayments,
} from "./settlement-store";
import { buildSettlementState } from "./settlement-state";
import { jalaliMonthSpan } from "@/lib/format/jalali";
import { db } from "@/lib/db";
import { notifyUnitAccounts } from "./notifications";
import {
  billingPeriod,
  expenseCategory,
  expenseLine,
  invoiceLineItem,
  periodSnapshot,
  unit,
  unitInvoice,
  periodChargePlan,
} from "@/lib/db/schema";
import {
  ensureMonthlyChargeCategory,
  periodChargeCategories,
} from "./monthly-charge";

export async function finalizeBillingPeriod(periodId: string) {
  return db.transaction(async (tx) => {
    const period = await tx.query.billingPeriod.findFirst({
      where: eq(billingPeriod.id, periodId),
    });
    if (!period || period.deletedAt || period.status !== "draft")
      throw new Error("این دوره قبلاً نهایی شده است.");
    const building = await tx.query.building.findFirst({
      where: (b, { eq }) => eq(b.id, period.buildingId),
    });
    if (!building) throw new Error("ساختمان پیدا نشد.");
    const units = await tx.query.unit.findMany({
      where: and(
        eq(unit.buildingId, period.buildingId),
        isNull(unit.deletedAt),
      ),
      orderBy: (u, { asc }) => [asc(u.sortOrder), asc(u.label)],
    });
    if (!units.length) throw new Error("ابتدا واحدهای ساختمان را ثبت کنید.");
    const plan = await tx.query.periodChargePlan.findFirst({
      where: eq(periodChargePlan.periodId, periodId),
    });
    if ((plan?.manualMonthlyRial ?? 0) > 0)
      await ensureMonthlyChargeCategory(tx, period.buildingId);
    const allCategories = periodChargeCategories(
      await tx.query.expenseCategory.findMany({
        where: eq(expenseCategory.buildingId, period.buildingId),
      }),
      plan?.manualMonthlyRial,
    );
    const recordedExpenses = await tx.query.expenseLine.findMany({
      where: and(
        eq(expenseLine.periodId, periodId),
        isNull(expenseLine.deletedAt),
      ),
    });
    const fund = usesChargeFund(period, plan?.manualMonthlyRial);
    const expenses = receivableExpenses(allCategories, recordedExpenses, fund);
    const categories = allCategories.filter(
      (c) => c.active || expenses.some((e) => e.categoryId === c.id),
    );
    if (
      !expenses.length &&
      !(fund && recordedExpenses.length) &&
      !categories.some(
        (c) =>
          c.allocationMethod === "fixed_per_unit" &&
          (c.fixedMonthlyAmount ?? 0) > 0,
      )
    )
      throw new Error("ابتدا هزینه‌های دوره را ثبت کنید.");
    const snapshots = units.map((u) => ({
      unitId: u.id,
      label: u.label,
      occupantCount: u.occupantCount,
      temporarilyAbsent: u.temporarilyAbsent,
      status: u.status,
    }));
    const preview = allocatePeriodCharges(snapshots, categories, expenses, {
      perUnitIncludeEmpty: building.perUnitIncludeEmpty,
      periodMonths: jalaliMonthSpan(period.startDate, period.endDate),
    });
    await reconcileDraftPayments(tx, period.buildingId);
    const accountsBeforeIssue = buildSettlementState(
      await loadSettlementData(tx, period.buildingId),
    ).accounts;
    const sharedTotal = expenses
      .filter((e) => {
        const c = categories.find((c) => c.id === e.categoryId);
        return (
          c &&
          c.allocationMethod !== "excluded" &&
          c.allocationMethod !== "fixed_per_unit"
        );
      })
      .reduce((s, e) => s + e.amountRial, 0);
    const allocatedShared = preview.lines
      .filter(
        (l) =>
          categories.find((c) => c.id === l.categoryId)?.allocationMethod !==
          "fixed_per_unit",
      )
      .reduce((s, l) => s + l.amountRial, 0);
    if (sharedTotal !== allocatedShared)
      throw new Error(
        "هزینه‌ای بدون سهم مانده است؛ تعداد نفرات و وضعیت واحدها را بررسی کنید.",
      );
    const claimed = await tx
      .update(billingPeriod)
      .set({
        status: "finalized",
        finalizedAt: new Date(),
        chargeModel: fund ? "fund" : "direct",
      })
      .where(
        and(eq(billingPeriod.id, periodId), eq(billingPeriod.status, "draft")),
      )
      .returning({ id: billingPeriod.id });
    if (!claimed.length) throw new Error("این دوره قبلاً نهایی شده است.");
    for (const u of units) {
      await tx.insert(periodSnapshot).values({
        id: crypto.randomUUID(),
        periodId,
        unitId: u.id,
        occupantCount: u.occupantCount,
        temporarilyAbsent: u.temporarilyAbsent,
        status: u.status,
      });
      const previousBalance =
        accountsBeforeIssue.find((a) => a.unitId === u.id)?.balanceRial ?? 0;
      const subtotal = preview.byUnit[u.id]?.totalRial ?? 0;
      const id = crypto.randomUUID();
      await tx.insert(unitInvoice).values({
        id,
        periodId,
        unitId: u.id,
        subtotalRial: subtotal,
        previousBalanceRial: previousBalance,
        totalRial: subtotal,
        paidRial: 0,
        balanceRial: subtotal,
      });
      for (const [index, line] of (preview.byUnit[u.id]?.lines ?? []).entries())
        await tx.insert(invoiceLineItem).values({
          id: crypto.randomUUID(),
          invoiceId: id,
          categoryId: line.categoryId,
          title: line.categoryName,
          basis: line.basis,
          amountRial: line.amountRial,
          sortOrder: index,
        });
    }
    for (const u of units) {
      const state = buildSettlementState(
        await loadSettlementData(tx, period.buildingId),
      );
      await applyAvailableCredit(
        tx,
        period.buildingId,
        u.id,
        state.shares.filter(
          (s) => s.unitId === u.id && s.periodId === periodId,
        ),
      );
    }
    await syncInvoicePayments(tx, period.buildingId);
    await notifyUnitAccounts(
      tx,
      period.buildingId,
      units.map((u) => u.id),
      "فیش شارژ جدید",
      `فیش «${period.title}» صادر شد. مانده و جزئیات آن در فیش‌های من به‌روز است.`,
      "invoice",
    );
    return preview;
  });
}

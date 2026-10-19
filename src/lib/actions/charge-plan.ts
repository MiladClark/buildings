"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  billingPeriod,
  chargeBudgetPolicy,
  expenseCategory,
  expenseLine,
  periodChargePlan,
} from "@/lib/db/schema";
import { requireManager } from "@/lib/session";
import { logManagementEvent } from "@/lib/billing/corrections";
import { budgetModes, type BudgetPolicy } from "@/lib/billing/charge-plan";

function refresh() {
  revalidatePath("/manager", "layout");
}
function validMoney(value: number | null) {
  return value === null || (Number.isSafeInteger(value) && value >= 0);
}

export async function saveManualMonthlyCharge(
  periodId: string,
  amountRial: number | null,
) {
  const { member, session } = await requireManager();
  if (!validMoney(amountRial)) throw new Error("مبلغ شارژ معتبر نیست.");
  await db.transaction(async (tx) => {
    const period = await tx.query.billingPeriod.findFirst({
      where: and(
        eq(billingPeriod.id, periodId),
        eq(billingPeriod.buildingId, member.buildingId),
        isNull(billingPeriod.deletedAt),
      ),
    });
    if (!period) throw new Error("دوره پیدا نشد.");
    const before = await tx.query.periodChargePlan.findFirst({
      where: eq(periodChargePlan.periodId, periodId),
    });
    await tx
      .insert(periodChargePlan)
      .values({ periodId, manualMonthlyRial: amountRial })
      .onConflictDoUpdate({
        target: periodChargePlan.periodId,
        set: { manualMonthlyRial: amountRial },
      });
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "charge_plan",
      periodId,
      "edit",
      "شارژ ثابت دستی دوره",
      before,
      { manualMonthlyRial: amountRial },
    );
  });
  refresh();
}

export async function saveChargeBudget(
  periodId: string,
  input: {
    bufferPercent: number;
    roundToRial: number;
    policies: BudgetPolicy[];
    coverage: { expenseId: string; months: number | null }[];
  },
) {
  const { member, session } = await requireManager();
  if (
    !Number.isInteger(input.bufferPercent) ||
    input.bufferPercent < 0 ||
    input.bufferPercent > 100 ||
    ![100000, 250000, 500000, 1000000].includes(input.roundToRial)
  )
    throw new Error("حاشیه نوسان یا گرد کردن معتبر نیست.");
  if (
    input.policies.length > 500 ||
    input.coverage.length > 3000 ||
    new Set(input.policies.map((p) => p.categoryId)).size !==
      input.policies.length ||
    new Set(input.coverage.map((c) => c.expenseId)).size !==
      input.coverage.length
  )
    throw new Error("تنظیمات تکراری یا بیش از حد است.");
  const validMonths = (n: number | null) =>
    n === null || (Number.isInteger(n) && n >= 1 && n <= 36);
  if (
    input.policies.some(
      (p) =>
        !budgetModes.includes(p.mode) ||
        !validMonths(p.intervalMonths) ||
        !validMoney(p.monthlyReserveRial),
    ) ||
    input.coverage.some((c) => !validMonths(c.months))
  )
    throw new Error("بازه قبض یا مبلغ ذخیره معتبر نیست.");
  await db.transaction(async (tx) => {
    const periods = await tx
      .select()
      .from(billingPeriod)
      .where(
        and(
          eq(billingPeriod.buildingId, member.buildingId),
          isNull(billingPeriod.deletedAt),
        ),
      );
    if (!periods.some((p) => p.id === periodId))
      throw new Error("دوره پیدا نشد.");
    const categories = await tx
      .select()
      .from(expenseCategory)
      .where(eq(expenseCategory.buildingId, member.buildingId));
    if (
      input.policies.some(
        (p) =>
          !categories.some((c) => c.id === p.categoryId) ||
          (categories.find((c) => c.id === p.categoryId)?.allocationMethod ===
            "per_person" &&
            p.mode !== "separate"),
      )
    )
      throw new Error(
        "دسته هزینه معتبر نیست؛ هزینه‌های نفرمحور جدا از پایه حساب می‌شوند.",
      );
    const rows = await tx
      .select({ expense: expenseLine })
      .from(expenseLine)
      .innerJoin(billingPeriod, eq(expenseLine.periodId, billingPeriod.id))
      .where(
        and(
          eq(billingPeriod.buildingId, member.buildingId),
          isNull(billingPeriod.deletedAt),
          isNull(expenseLine.deletedAt),
        ),
      );
    if (
      input.coverage.some(
        (c) => !rows.some((r) => r.expense.id === c.expenseId),
      )
    )
      throw new Error("قبض پیدا نشد؛ صفحه را تازه کنید.");
    const previousPolicies = await tx
      .select()
      .from(chargeBudgetPolicy)
      .where(eq(chargeBudgetPolicy.buildingId, member.buildingId));
    const previousPlan = await tx.query.periodChargePlan.findFirst({
      where: eq(periodChargePlan.periodId, periodId),
    });
    for (const policy of input.policies)
      await tx
        .insert(chargeBudgetPolicy)
        .values({ ...policy, buildingId: member.buildingId })
        .onConflictDoUpdate({
          target: chargeBudgetPolicy.categoryId,
          set: policy,
        });
    for (const coverage of input.coverage)
      await tx
        .update(expenseLine)
        .set({ coverageMonths: coverage.months })
        .where(eq(expenseLine.id, coverage.expenseId));
    await tx
      .insert(periodChargePlan)
      .values({
        periodId,
        bufferPercent: input.bufferPercent,
        roundToRial: input.roundToRial,
      })
      .onConflictDoUpdate({
        target: periodChargePlan.periodId,
        set: {
          bufferPercent: input.bufferPercent,
          roundToRial: input.roundToRial,
        },
      });
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "charge_plan",
      periodId,
      "edit",
      "مبنای پیشنهاد شارژ",
      {
        plan: previousPlan,
        policies: previousPolicies,
        coverage: rows
          .filter((r) =>
            input.coverage.some((c) => c.expenseId === r.expense.id),
          )
          .map((r) => ({
            expenseId: r.expense.id,
            months: r.expense.coverageMonths,
          })),
      },
      input,
    );
  });
  refresh();
}

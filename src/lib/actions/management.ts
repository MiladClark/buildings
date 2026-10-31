"use server";
import { periodTypes, type PeriodType } from "@/lib/billing/periods";
import { monthlyChargeSlug } from "@/lib/billing/monthly-charge";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { invalidateCurrentBuildingCache } from "@/lib/cache/building";
import { db } from "@/lib/db";
import {
  billingPeriod,
  expenseCategory,
  expenseLine,
  maintenanceTicket,
  managementEvent,
  membership,
  payment,
  paymentRequest,
  unit,
} from "@/lib/db/schema";
import { requireManager } from "@/lib/session";
import type { UtilityBill } from "@/lib/billing/utility-bill";
import {
  correctExpense,
  correctReceipt,
  logManagementEvent,
  releaseCostApplications,
  periodCalculationChanged,
  removePeriod,
  reopenPeriod,
  type RecoverableEntity,
} from "@/lib/billing/corrections";
import { reconcileDraftPayments } from "@/lib/billing/settlement-store";
import { mutationResult } from "@/lib/action-result";

async function refresh() {
  await invalidateCurrentBuildingCache();
}

export async function editReceipt(
  id: string,
  data: {
    unitId: string;
    periodId?: string;
    categoryId?: string;
    standaloneExpenseId?: string;
    kind?: "receipt" | "advance";
    amountRial: number;
    method: "bank_transfer" | "cash" | "other";
    paidAt: string;
    note?: string;
  },
) {
  const { member, session } = await requireManager();
  await db.transaction((tx) =>
    correctReceipt(tx, member.buildingId, id, "edit", session.user.id, {
      ...data,
      paidAt: new Date(data.paidAt),
    }),
  );
  await refresh();
}

export async function releaseCostSettlement(data: {
  unitId: string;
  periodId: string;
  categoryId: string | null;
  amountRial?: number;
}) {
  const { member, session } = await requireManager();
  await db.transaction(async (tx) => {
    const { applications, amountRial } = await releaseCostApplications(
      tx,
      member.buildingId,
      data,
    );
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "payment",
      data.unitId,
      "release",
      "برگشت تخصیص به بستانکاری",
      {
        ...data,
        applications,
        amountRial,
      },
    );
  });
  await refresh();
}

export async function managePeriod(
  id: string,
  operation: "reopen" | "archive" | "unarchive",
) {
  const { member, session } = await requireManager();
  await db.transaction(async (tx) => {
    const p = await tx.query.billingPeriod.findFirst({
      where: and(
        eq(billingPeriod.id, id),
        eq(billingPeriod.buildingId, member.buildingId),
      ),
    });
    if (!p || p.deletedAt) throw new Error("دوره پیدا نشد.");
    if (operation === "reopen")
      await reopenPeriod(tx, member.buildingId, id, session.user.id);
    else {
      if (
        (operation === "archive" && p.status !== "finalized") ||
        (operation === "unarchive" && p.status !== "archived")
      )
        throw new Error("وضعیت دوره تغییر کرده است.");
      const status = operation === "archive" ? "archived" : "finalized";
      await tx
        .update(billingPeriod)
        .set({ status })
        .where(eq(billingPeriod.id, id));
      await logManagementEvent(
        tx,
        member.buildingId,
        session.user.id,
        "period",
        id,
        operation,
        p.title,
        p,
        { status },
      );
    }
  });
  await refresh();
}

export async function editPeriod(
  id: string,
  data: {
    title: string;
    periodType: PeriodType;
    startDate: string;
    endDate: string;
    dueDate?: string;
  },
) {
  const { member, session } = await requireManager();
  const startDate = new Date(data.startDate),
    endDate = new Date(data.endDate),
    dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (
    !data.title.trim() ||
    data.title.length > 200 ||
    !periodTypes.includes(data.periodType) ||
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime()) ||
    endDate < startDate ||
    (dueDate && !Number.isFinite(dueDate.getTime()))
  )
    throw new Error("عنوان و تاریخ‌های دوره را درست وارد کنید.");
  await db.transaction(async (tx) => {
    const p = await tx.query.billingPeriod.findFirst({
      where: and(
        eq(billingPeriod.id, id),
        eq(billingPeriod.buildingId, member.buildingId),
      ),
    });
    if (!p || p.deletedAt) throw new Error("دوره پیدا نشد.");
    // Metadata/due-date edits do not revoke bills. Changes affecting prorating do.
    if (
      periodCalculationChanged(p, {
        startDate,
        endDate,
        periodType: data.periodType,
      })
    )
      await reopenPeriod(tx, member.buildingId, id, session.user.id);
    const values = {
      title: data.title.trim(),
      periodType: data.periodType,
      startDate,
      endDate,
      dueDate,
    };
    await tx.update(billingPeriod).set(values).where(eq(billingPeriod.id, id));
    await reconcileDraftPayments(tx, member.buildingId);
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "period",
      id,
      "edit",
      values.title,
      p,
      values,
    );
  });
  await refresh();
}

export async function editExpense(
  id: string,
  data: {
    utilityBill?: UtilityBill | null;
    billingTreatment?: "auto" | "separate";
    coverageMonths?: number | null;
    categoryId: string;
    amountRial: number;
    description: string;
    expenseDate: string;
    maintenanceTicketId?: string | null;
  },
) {
  const { member, session } = await requireManager();
  await db.transaction((tx) =>
    correctExpense(tx, member.buildingId, id, "edit", session.user.id, {
      ...data,
      expenseDate: new Date(data.expenseDate),
    }),
  );
  await refresh();
}

export async function setRecordDeleted(
  type: RecoverableEntity,
  id: string,
  deleted: boolean,
) {
  return mutationResult(async () => {
    const { member, session } = await requireManager();
    const bid = member.buildingId,
      actor = session.user.id;
    await db.transaction(async (tx) => {
      if (type === "payment")
        await correctReceipt(
          tx,
          bid,
          id,
          deleted ? "delete" : "restore",
          actor,
        );
      else if (type === "expense")
        await correctExpense(
          tx,
          bid,
          id,
          deleted ? "delete" : "restore",
          actor,
        );
      else if (type === "period" && deleted)
        await removePeriod(tx, bid, id, actor);
      else if (type === "category") {
        const row = await tx.query.expenseCategory.findFirst({
          where: and(
            eq(expenseCategory.id, id),
            eq(expenseCategory.buildingId, bid),
          ),
        });
        if (!row || row.slug === monthlyChargeSlug || row.active !== deleted)
          throw new Error("وضعیت دسته تغییر کرده است.");
        await tx
          .update(expenseCategory)
          .set({ active: !deleted })
          .where(eq(expenseCategory.id, id));
        await reconcileDraftPayments(tx, bid);
        await logManagementEvent(
          tx,
          bid,
          actor,
          type,
          id,
          deleted ? "delete" : "restore",
          row.name,
          row,
        );
      } else if (type === "request") {
        const row = await tx.query.paymentRequest.findFirst({
          where: eq(paymentRequest.id, id),
        });
        const owner =
          row &&
          (await tx.query.unit.findFirst({
            where: and(eq(unit.id, row.unitId), eq(unit.buildingId, bid)),
          }));
        if (!row || !owner || Boolean(row.deletedAt) !== !deleted)
          throw new Error("اعلام واریز پیدا نشد یا وضعیتش تغییر کرده است.");
        await tx
          .update(paymentRequest)
          .set({ deletedAt: deleted ? new Date() : null })
          .where(eq(paymentRequest.id, id));
        await logManagementEvent(
          tx,
          bid,
          actor,
          type,
          id,
          deleted ? "delete" : "restore",
          `اعلام واریز واحد ${owner.label}`,
          row,
        );
      } else if (
        type === "unit" ||
        type === "maintenance" ||
        (type === "period" && !deleted)
      ) {
        const table =
          type === "unit"
            ? unit
            : type === "maintenance"
              ? maintenanceTicket
              : billingPeriod;
        const [row] = await tx
          .select()
          .from(table)
          .where(and(eq(table.id, id), eq(table.buildingId, bid)));
        if (!row || Boolean(row.deletedAt) !== !deleted)
          throw new Error("وضعیت این مورد تغییر کرده است.");
        await tx
          .update(table)
          .set({ deletedAt: deleted ? new Date() : null })
          .where(eq(table.id, id));
        await reconcileDraftPayments(tx, bid);
        const label = "label" in row ? `واحد ${row.label}` : row.title;
        await logManagementEvent(
          tx,
          bid,
          actor,
          type,
          id,
          deleted ? "delete" : "restore",
          label,
          row,
        );
      } else throw new Error("عملیات معتبر نیست.");
    });
    await refresh();
  });
}

export async function unlinkResident(id: string) {
  const { member, session } = await requireManager();
  await db.transaction(async (tx) => {
    const row = await tx.query.membership.findFirst({
      where: and(
        eq(membership.id, id),
        eq(membership.buildingId, member.buildingId),
        eq(membership.role, "resident"),
      ),
    });
    if (!row) throw new Error("حساب پیدا نشد.");
    await tx
      .update(membership)
      .set({ unitId: null })
      .where(eq(membership.id, id));
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "membership",
      id,
      "unlink",
      "قطع اتصال حساب ساکن",
      row,
    );
  });
  await refresh();
}

export async function resetPaymentReport(id: string) {
  const { member, session } = await requireManager();
  await db.transaction(async (tx) => {
    const row = await tx.query.paymentRequest.findFirst({
      where: eq(paymentRequest.id, id),
    });
    const u =
      row &&
      (await tx.query.unit.findFirst({
        where: and(
          eq(unit.id, row.unitId),
          eq(unit.buildingId, member.buildingId),
        ),
      }));
    if (!row || row.deletedAt || !u) throw new Error("اعلام واریز پیدا نشد.");
    const receipts = await tx
      .select()
      .from(payment)
      .where(eq(payment.buildingId, member.buildingId));
    for (const receipt of receipts.filter(
      (p) =>
        !p.deletedAt &&
        (p.receiptKey === `request:${id}` ||
          p.receiptKey?.startsWith(`request:${id}:`)),
    ))
      await correctReceipt(
        tx,
        member.buildingId,
        receipt.id,
        "delete",
        session.user.id,
      );
    await tx
      .update(paymentRequest)
      .set({ status: "pending" })
      .where(eq(paymentRequest.id, id));
    await logManagementEvent(
      tx,
      member.buildingId,
      session.user.id,
      "request",
      id,
      "reopen",
      `اعلام واریز واحد ${u.label}`,
      row,
    );
  });
  await refresh();
}

export async function getManagementHistory() {
  const { member } = await requireManager();
  const bid = member.buildingId;
  const [
    events,
    units,
    periods,
    receipts,
    tickets,
    categories,
    expenses,
    reports,
  ] = await Promise.all([
    db
      .select()
      .from(managementEvent)
      .where(eq(managementEvent.buildingId, bid))
      .orderBy(desc(managementEvent.createdAt), desc(managementEvent.id)),
    db
      .select()
      .from(unit)
      .where(and(eq(unit.buildingId, bid), isNotNull(unit.deletedAt))),
    db
      .select()
      .from(billingPeriod)
      .where(
        and(
          eq(billingPeriod.buildingId, bid),
          isNotNull(billingPeriod.deletedAt),
        ),
      ),
    db
      .select()
      .from(payment)
      .where(and(eq(payment.buildingId, bid), isNotNull(payment.deletedAt))),
    db
      .select()
      .from(maintenanceTicket)
      .where(
        and(
          eq(maintenanceTicket.buildingId, bid),
          isNotNull(maintenanceTicket.deletedAt),
        ),
      ),
    db
      .select()
      .from(expenseCategory)
      .where(
        and(
          eq(expenseCategory.buildingId, bid),
          eq(expenseCategory.active, false),
        ),
      ),
    db
      .select({ expense: expenseLine, period: billingPeriod })
      .from(expenseLine)
      .innerJoin(billingPeriod, eq(expenseLine.periodId, billingPeriod.id))
      .where(
        and(
          eq(billingPeriod.buildingId, bid),
          isNotNull(expenseLine.deletedAt),
        ),
      ),
    db
      .select({ report: paymentRequest, unit })
      .from(paymentRequest)
      .innerJoin(unit, eq(paymentRequest.unitId, unit.id))
      .where(
        and(eq(unit.buildingId, bid), isNotNull(paymentRequest.deletedAt)),
      ),
  ]);
  const trash: {
    id: string;
    type: RecoverableEntity;
    label: string;
    date: string;
    detail: string;
  }[] = [
    ...reports.map(({ report: r, unit: u }) => ({
      id: r.id,
      type: "request" as const,
      label: `اعلام واریز واحد ${u.label}`,
      date: r.deletedAt!.toISOString(),
      detail:
        "اعلام واریز با وضعیت فعلی برمی‌گردد؛ دریافت جدیدی ایجاد نمی‌شود.",
    })),
    ...units.map((r) => ({
      id: r.id,
      type: "unit" as const,
      label: `واحد ${r.label}`,
      date: r.deletedAt!.toISOString(),
      detail: "با بازیابی، دوباره در محاسبات پیش‌نویس‌ها سهم می‌گیرد.",
    })),
    ...periods.map((r) => ({
      id: r.id,
      type: "period" as const,
      label: r.title,
      date: r.deletedAt!.toISOString(),
      detail:
        "به صورت پیش‌نویس برمی‌گردد؛ هزینه‌ها حفظ شده‌اند. فیش‌ها باید دوباره صادر شوند.",
    })),
    ...receipts.map((r) => ({
      id: r.id,
      type: "payment" as const,
      label: r.note || "واریز واحد",
      date: r.deletedAt!.toISOString(),
      detail:
        "همان دریافت برمی‌گردد و با مانده فعلی هزینه تخصیص می‌یابد؛ اضافه مبلغ بستانکاری می‌شود.",
    })),
    ...tickets.map((r) => ({
      id: r.id,
      type: "maintenance" as const,
      label: r.title,
      date: r.deletedAt!.toISOString(),
      detail: "با وضعیت قبل از حذف برمی‌گردد.",
    })),
    ...categories
      .filter((r) => r.slug !== monthlyChargeSlug)
      .map((r) => ({
        id: r.id,
        type: "category" as const,
        label: r.name,
        date: "",
        detail: "برای ثبت هزینه و شارژ ثابت دوره‌های باز دوباره فعال می‌شود.",
      })),
    ...expenses.map(({ expense: r, period: p }) => ({
      id: r.id,
      type: "expense" as const,
      label: r.description || "هزینه ساختمان",
      date: r.deletedAt!.toISOString(),
      detail: p.deletedAt
        ? "ابتدا دوره این هزینه را بازیابی کنید."
        : `به ${p.title} برمی‌گردد؛ اگر نهایی باشد برای اصلاح باز می‌شود.`,
    })),
  ];
  return { events, trash };
}

"use server";
import { periodTypes, type PeriodType } from "@/lib/billing/periods";

import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { setRecordDeleted } from "./management";
import { logManagementEvent } from "@/lib/billing/corrections";
import { notifyUnitAccounts } from "@/lib/billing/notifications";
import { validateMaintenanceLink } from "@/lib/billing/maintenance-link";
import { allocatePeriodCharges } from "@/lib/billing/engine";
import { receivableExpenses, usesChargeFund } from "@/lib/billing/charge-model";
import {
  periodChargeCategories,
  monthlyChargeSlug,
} from "@/lib/billing/monthly-charge";
import {
  applyAvailableCredit,
  insertUnitPayment,
  loadSettlementData,
  reconcileDraftPayments,
} from "@/lib/billing/settlement-store";
import { buildSettlementState } from "@/lib/billing/settlement-state";
import { finalizeBillingPeriod } from "@/lib/billing/finalize";
import { computeChargeRecommendation } from "@/lib/billing/recommendations";
import { db } from "@/lib/db";
import {
  appNotification,
  billingPeriod,
  building,
  expenseCategory,
  expenseLine,
  membership,
  paymentRequest,
  rateAdjustment,
  unit,
  user,
} from "@/lib/db/schema";
import { requireManager, requireResident, requireSession } from "@/lib/session";
import { jalaliMonthSpan, nextJalaliDueDate } from "@/lib/format/jalali";

function refresh() {
  revalidatePath("/manager", "layout");
  revalidatePath("/resident", "layout");
}
function text(value: string, label: string) {
  if (!value?.trim() || value.length > 500)
    throw new Error(`${label} را به‌درستی وارد کنید.`);
  return value.trim();
}
function amount(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("مبلغ باید عدد صحیح و بیشتر از صفر باشد.");
  return value;
}
function date(value: string) {
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new Error("تاریخ معتبر نیست.");
  return result;
}
async function getManagerBuilding() {
  const { member } = await requireManager();
  const b = await db.query.building.findFirst({
    where: eq(building.id, member.buildingId),
  });
  if (!b) throw new Error("ساختمان پیدا نشد.");
  return b;
}
async function ownedPeriod(id: string) {
  const b = await getManagerBuilding();
  const p = await db.query.billingPeriod.findFirst({
    where: and(eq(billingPeriod.id, id), eq(billingPeriod.buildingId, b.id)),
  });
  if (!p || p.deletedAt) throw new Error("دوره پیدا نشد.");
  return { b, p };
}
export async function updateBuildingSettings(data: {
  name: string;
  address?: string;
  bankAccount?: string;
  bankSheba?: string;
  paymentDueDay?: number;
  perUnitIncludeEmpty?: boolean;
}) {
  const b = await getManagerBuilding();
  const day = data.paymentDueDay ?? b.paymentDueDay;
  if (!Number.isInteger(day) || day < 1 || day > 28)
    throw new Error("روز سررسید باید بین ۱ و ۲۸ باشد.");
  await db.transaction(async (tx) => {
    await tx
      .update(building)
      .set({
        ...data,
        name: text(data.name, "نام ساختمان"),
        paymentDueDay: day,
      })
      .where(eq(building.id, b.id));
    await reconcileDraftPayments(tx, b.id);
    const session = await requireSession();
    await logManagementEvent(
      tx,
      b.id,
      session.user.id,
      "settings",
      b.id,
      "edit",
      "تنظیمات ساختمان",
      b,
      data,
    );
  });
  refresh();
}
export async function listUnits() {
  const b = await getManagerBuilding();
  return db
    .select()
    .from(unit)
    .where(and(eq(unit.buildingId, b.id), isNull(unit.deletedAt)))
    .orderBy(asc(unit.sortOrder), asc(unit.label));
}
export async function upsertUnit(data: {
  id?: string;
  label: string;
  floor?: number;
  status: "occupied" | "empty" | "owner_occupied";
  occupantCount: number;
  temporarilyAbsent?: boolean;
  ownerName?: string;
  tenantName?: string;
}) {
  const b = await getManagerBuilding();
  if (!["occupied", "empty", "owner_occupied"].includes(data.status))
    throw new Error("وضعیت واحد معتبر نیست.");
  if (
    data.temporarilyAbsent !== undefined &&
    typeof data.temporarilyAbsent !== "boolean"
  )
    throw new Error("وضعیت حضور واحد معتبر نیست.");
  if (
    !Number.isInteger(data.occupantCount) ||
    data.occupantCount < 0 ||
    data.occupantCount > 100 ||
    (data.status !== "empty" &&
      !data.temporarilyAbsent &&
      data.occupantCount < 1)
  )
    throw new Error("برای واحد مسکونی تعداد نفرات را حداقل یک نفر وارد کنید.");
  const values = {
    label: text(data.label, "شماره واحد"),
    floor: data.floor,
    status: data.status,
    occupantCount: data.status === "empty" ? 0 : data.occupantCount,
    temporarilyAbsent: data.temporarilyAbsent ?? false,
    ownerName: data.ownerName,
    tenantName: data.tenantName,
  };
  const duplicate = await db.query.unit.findFirst({
    where: and(eq(unit.buildingId, b.id), eq(unit.label, values.label)),
  });
  if (duplicate && duplicate.id !== data.id)
    throw new Error("این شماره واحد قبلاً ثبت شده است.");
  await db.transaction(async (tx) => {
    const previous = data.id
      ? await tx.query.unit.findFirst({
          where: and(eq(unit.id, data.id), eq(unit.buildingId, b.id)),
        })
      : undefined;
    if (data.id && (!previous || previous.deletedAt))
      throw new Error("واحد پیدا نشد.");
    if (data.id)
      await tx
        .update(unit)
        .set(values)
        .where(and(eq(unit.id, data.id), eq(unit.buildingId, b.id)));
    else
      await tx.insert(unit).values({
        ...values,
        id: crypto.randomUUID(),
        buildingId: b.id,
        sortOrder: Date.now(),
      });
    await reconcileDraftPayments(tx, b.id);
    if (data.id) {
      const session = await requireSession();
      await logManagementEvent(
        tx,
        b.id,
        session.user.id,
        "unit",
        data.id,
        "edit",
        `واحد ${values.label}`,
        previous,
        values,
      );
    }
  });
  refresh();
}
export async function deleteUnit(unitId: string) {
  await setRecordDeleted("unit", unitId, true);
}
export async function listCategories() {
  const b = await getManagerBuilding();
  return db
    .select()
    .from(expenseCategory)
    .where(
      and(
        eq(expenseCategory.buildingId, b.id),
        eq(expenseCategory.active, true),
      ),
    )
    .orderBy(asc(expenseCategory.sortOrder));
}
export async function createCategory(data: {
  name: string;
  allocationMethod: "per_person" | "per_unit" | "fixed_per_unit" | "excluded";
  includeEmptyUnits: boolean;
  fixedMonthlyAmount?: number;
}) {
  const b = await getManagerBuilding();
  if (
    data.allocationMethod === "fixed_per_unit" &&
    (!Number.isSafeInteger(data.fixedMonthlyAmount) ||
      (data.fixedMonthlyAmount ?? 0) <= 0)
  )
    throw new Error(
      "برای شارژ ثابت، مبلغ ماهانه هر واحد را بیشتر از صفر وارد کنید.",
    );
  if (
    !["per_person", "per_unit", "fixed_per_unit", "excluded"].includes(
      data.allocationMethod,
    )
  )
    throw new Error("روش تقسیم معتبر نیست.");
  await db.insert(expenseCategory).values({
    id: crypto.randomUUID(),
    buildingId: b.id,
    name: text(data.name, "نام دسته"),
    slug: crypto.randomUUID(),
    allocationMethod: data.allocationMethod,
    includeEmptyUnits: data.includeEmptyUnits,
    fixedMonthlyAmount: data.fixedMonthlyAmount,
    sortOrder: Date.now(),
  });
  refresh();
}
export async function updateCategoryAllocation(
  categoryId: string,
  data: {
    allocationMethod?:
      "per_person" | "per_unit" | "fixed_per_unit" | "excluded";
    includeEmptyUnits?: boolean;
    fixedMonthlyAmount?: number | null;
    inflationPercent?: number;
    name?: string;
  },
) {
  const b = await getManagerBuilding();
  const prev = await db.query.expenseCategory.findFirst({
    where: and(
      eq(expenseCategory.id, categoryId),
      eq(expenseCategory.buildingId, b.id),
    ),
  });
  if (!prev) throw new Error("دسته پیدا نشد.");
  if (prev.slug === monthlyChargeSlug)
    throw new Error("مبلغ شارژ را از صفحه دوره مالی تغییر دهید.");
  if (data.name !== undefined) data.name = text(data.name, "نام دسته");
  if (
    (data.allocationMethod ?? prev.allocationMethod) === "fixed_per_unit" &&
    (data.fixedMonthlyAmount === undefined
      ? (prev.fixedMonthlyAmount ?? 0)
      : (data.fixedMonthlyAmount ?? 0)) <= 0
  )
    throw new Error(
      "برای شارژ ثابت، مبلغ ماهانه هر واحد را بیشتر از صفر وارد کنید.",
    );
  if (
    data.allocationMethod &&
    !["per_person", "per_unit", "fixed_per_unit", "excluded"].includes(
      data.allocationMethod,
    )
  )
    throw new Error("روش تقسیم معتبر نیست.");
  if (
    data.fixedMonthlyAmount != null &&
    (!Number.isSafeInteger(data.fixedMonthlyAmount) ||
      data.fixedMonthlyAmount < 0)
  )
    throw new Error("مبلغ ثابت معتبر نیست.");
  if (
    data.inflationPercent != null &&
    (!Number.isFinite(data.inflationPercent) ||
      data.inflationPercent < -100 ||
      data.inflationPercent > 1000)
  )
    throw new Error("درصد تعدیل باید بین منفی ۱۰۰ و ۱۰۰۰ باشد.");
  await db.transaction(async (tx) => {
    await tx
      .update(expenseCategory)
      .set(data)
      .where(eq(expenseCategory.id, categoryId));
    if (
      data.inflationPercent !== undefined &&
      data.inflationPercent !== prev.inflationPercent
    ) {
      const session = await requireSession();
      await tx.insert(rateAdjustment).values({
        id: crypto.randomUUID(),
        categoryId,
        previousValue: prev.inflationPercent,
        newValue: data.inflationPercent,
        percentChange: data.inflationPercent - (prev.inflationPercent ?? 0),
        reason: "تعدیل دستی نرخ پیشنهادی",
        adjustedByUserId: session.user.id,
      });
    }
    await reconcileDraftPayments(tx, b.id);
    const session = await requireSession();
    await logManagementEvent(
      tx,
      b.id,
      session.user.id,
      "category",
      categoryId,
      "edit",
      data.name ?? prev.name,
      prev,
      data,
    );
  });
  refresh();
}
export async function createBillingPeriod(data: {
  title: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  dueDate?: string;
}) {
  const b = await getManagerBuilding();
  const start = date(data.startDate),
    end = date(data.endDate);
  if (end < start) throw new Error("پایان دوره باید پس از شروع آن باشد.");
  if (!periodTypes.includes(data.periodType))
    throw new Error("نوع دوره معتبر نیست.");
  const id = crypto.randomUUID();
  await db.insert(billingPeriod).values({
    id,
    buildingId: b.id,
    title: text(data.title, "عنوان دوره"),
    periodType: data.periodType,
    startDate: start,
    endDate: end,
    dueDate: data.dueDate
      ? date(data.dueDate)
      : nextJalaliDueDate(end, b.paymentDueDay),
    status: "draft",
  });
  refresh();
  return id;
}
export async function addExpenseLine(data: {
  coverageMonths?: number | null;
  billingTreatment?: "auto" | "separate";
  maintenanceTicketId?: string;
  periodId: string;
  categoryId: string;
  amountRial: number;
  description?: string;
  expenseDate: string;
}) {
  const { b, p } = await ownedPeriod(data.periodId);
  if (
    data.coverageMonths != null &&
    (!Number.isInteger(data.coverageMonths) ||
      data.coverageMonths < 1 ||
      data.coverageMonths > 36)
  )
    throw new Error("بازه قبض معتبر نیست.");
  if (
    data.billingTreatment &&
    !["auto", "separate"].includes(data.billingTreatment)
  )
    throw new Error("روش پرداخت هزینه معتبر نیست.");
  if (p.status !== "draft")
    throw new Error("هزینه‌های دوره نهایی‌شده قابل تغییر نیستند.");
  const cat = await db.query.expenseCategory.findFirst({
    where: and(
      eq(expenseCategory.id, data.categoryId),
      eq(expenseCategory.buildingId, b.id),
    ),
  });
  if (!cat || !cat.active || cat.allocationMethod === "excluded")
    throw new Error("دسته هزینه معتبر نیست.");
  await db.transaction(async (tx) => {
    const current = await tx.query.billingPeriod.findFirst({
      where: eq(billingPeriod.id, data.periodId),
    });
    if (current?.status !== "draft" || current.deletedAt)
      throw new Error("این دوره دیگر پیش‌نویس نیست؛ صفحه را تازه کنید.");
    const currentCategory = await tx.query.expenseCategory.findFirst({
      where: eq(expenseCategory.id, data.categoryId),
    });
    if (
      !currentCategory ||
      !currentCategory.active ||
      currentCategory.allocationMethod === "excluded"
    )
      throw new Error("دسته هزینه تغییر کرده است؛ دوباره انتخاب کنید.");
    await validateMaintenanceLink(tx, b.id, data.maintenanceTicketId);
    await tx.insert(expenseLine).values({
      ...data,
      id: crypto.randomUUID(),
      amountRial: amount(data.amountRial),
      expenseDate: date(data.expenseDate),
    });
    await reconcileDraftPayments(tx, b.id);
  });
  refresh();
}
export async function deleteExpense(id: string) {
  await setRecordDeleted("expense", id, true);
}
export async function previewPeriod(periodId: string) {
  const { b, p } = await ownedPeriod(periodId);
  const data = await loadSettlementData(db, b.id);
  const expenses = receivableExpenses(
    data.categories,
    data.expenses.filter((e) => e.periodId === periodId),
    usesChargeFund(
      p,
      data.chargePlans?.find((plan) => plan.periodId === periodId)
        ?.manualMonthlyRial,
    ),
  );
  return allocatePeriodCharges(
    data.units.filter((u) => !u.deletedAt).map((u) => ({ ...u, unitId: u.id })),
    periodChargeCategories(
      data.categories,
      data.chargePlans?.find((plan) => plan.periodId === periodId)
        ?.manualMonthlyRial,
    ).filter((c) => c.active || expenses.some((e) => e.categoryId === c.id)),
    expenses,
    {
      perUnitIncludeEmpty: b.perUnitIncludeEmpty,
      periodMonths: jalaliMonthSpan(p.startDate, p.endDate),
    },
  );
}
export async function finalizePeriod(periodId: string) {
  await ownedPeriod(periodId);
  await finalizeBillingPeriod(periodId);
  refresh();
}
export async function recordPayment(data: {
  unitId: string;
  periodId?: string;
  categoryId?: string;
  receiptKey?: string;
  standaloneExpenseId?: string;
  kind?: "receipt" | "advance";
  amountRial: number;
  method: "bank_transfer" | "cash" | "other";
  paidAt: string;
  note?: string;
}) {
  const { session, member } = await requireManager();
  if (!["bank_transfer", "cash", "other"].includes(data.method))
    throw new Error("روش پرداخت معتبر نیست.");
  await db.transaction(async (tx) =>
    insertUnitPayment(
      tx,
      {
        ...data,
        amountRial: amount(data.amountRial),
        paidAt: date(data.paidAt),
      },
      member.buildingId,
      session.user.id,
    ),
  );
  refresh();
}
export async function reviewPaymentRequest(id: string, approve: boolean) {
  const { session, member } = await requireManager();
  await db.transaction(async (tx) => {
    const r = await tx.query.paymentRequest.findFirst({
      where: and(
        eq(paymentRequest.id, id),
        eq(paymentRequest.status, "pending"),
        isNull(paymentRequest.deletedAt),
      ),
    });
    if (!r) throw new Error("این درخواست قبلاً بررسی شده است.");
    const u = await tx.query.unit.findFirst({
      where: and(eq(unit.id, r.unitId), eq(unit.buildingId, member.buildingId)),
    });
    if (!u) throw new Error("درخواست پیدا نشد.");
    if (approve)
      await insertUnitPayment(
        tx,
        {
          unitId: r.unitId,
          periodId: r.periodId ?? undefined,
          categoryId: r.categoryId ?? undefined,
          receiptKey: `request:${r.id}:${crypto.randomUUID()}`,
          amountRial: amount(r.amountRial),
          method: "bank_transfer",
          paidAt: new Date(),
          note: r.note ?? undefined,
        },
        member.buildingId,
        session.user.id,
      );
    await tx
      .update(paymentRequest)
      .set({ status: approve ? "approved" : "rejected" })
      .where(eq(paymentRequest.id, id));
    await tx.insert(appNotification).values({
      id: crypto.randomUUID(),
      userId: r.userId,
      title: approve ? "پرداخت شما تأیید شد" : "پرداخت نیاز به بررسی دارد",
      body: approve
        ? "مبلغ واریزی در حساب واحد شما ثبت شد."
        : "برای بررسی اطلاعات واریز با مدیر ساختمان تماس بگیرید.",
    });
  });
  refresh();
}
export async function requestPayment(data: {
  amountRial: number;
  note?: string;
  periodId?: string;
  categoryId?: string;
}) {
  const { session, member } = await requireResident();
  if (!member.unitId) throw new Error("هنوز واحدی به حساب شما متصل نشده است.");
  const currentUnit = await db.query.unit.findFirst({
    where: and(
      eq(unit.id, member.unitId),
      eq(unit.buildingId, member.buildingId),
      isNull(unit.deletedAt),
    ),
  });
  if (!currentUnit)
    throw new Error(
      "برای اعلام واریز، حساب باید به یک واحد فعال متصل باشد؛ سوابق قبلی شما حفظ شده‌اند.",
    );
  if (data.categoryId || data.periodId) {
    const ledger = await loadSettlementData(db, member.buildingId);
    if (
      !data.categoryId ||
      !data.periodId ||
      !buildSettlementState(ledger).shares.some(
        (s) =>
          s.unitId === member.unitId &&
          s.periodId === data.periodId &&
          s.categoryId === data.categoryId,
      )
    )
      throw new Error("هزینه انتخاب‌شده معتبر نیست.");
  }
  await db.insert(paymentRequest).values({
    id: crypto.randomUUID(),
    unitId: member.unitId,
    userId: session.user.id,
    amountRial: amount(data.amountRial),
    periodId: data.periodId,
    categoryId: data.categoryId,
    note: data.note,
    status: "pending",
  });
  refresh();
}
export async function settleCostFromCredit(data: {
  unitId: string;
  periodId: string;
  categoryId: string | null;
  amountRial?: number;
}) {
  const b = await getManagerBuilding();
  await db.transaction(async (tx) => {
    await reconcileDraftPayments(tx, b.id);
    const state = buildSettlementState(await loadSettlementData(tx, b.id));
    const share = state.shares.find(
      (s) =>
        s.unitId === data.unitId &&
        s.periodId === data.periodId &&
        s.categoryId === data.categoryId,
    );
    if (!share || share.balanceRial <= 0)
      throw new Error("این هزینه مانده قابل تسویه ندارد.");
    const available =
      state.accounts.find((a) => a.unitId === data.unitId)?.creditRial ?? 0;
    if (
      data.amountRial !== undefined &&
      (!Number.isSafeInteger(data.amountRial) ||
        data.amountRial <= 0 ||
        data.amountRial > Math.min(available, share.balanceRial))
    )
      throw new Error(
        "مبلغ از بستانکاری آزاد یا مانده هزینه بیشتر است؛ اطلاعات را دوباره بررسی کنید.",
      );
    const applied = await applyAvailableCredit(
      tx,
      b.id,
      data.unitId,
      [share],
      data.amountRial,
    );
    if (!applied) throw new Error("این واحد بستانکاری قابل استفاده ندارد.");
    const session = await requireSession();
    await logManagementEvent(
      tx,
      b.id,
      session.user.id,
      "payment",
      data.unitId,
      "settle",
      "تخصیص بستانکاری به هزینه",
      { ...data, amountRial: applied },
    );
    await notifyUnitAccounts(
      tx,
      b.id,
      [data.unitId],
      "تسویه از بستانکاری",
      "مدیر بخشی از بستانکاری واحد را به یک هزینه تخصیص داد؛ دریافت جدیدی ثبت نشده است.",
    );
  });
  refresh();
}
export async function runChargeRecommendation(monthsWindow: number) {
  const b = await getManagerBuilding();
  if (!Number.isInteger(monthsWindow) || monthsWindow < 1 || monthsWindow > 24)
    throw new Error("بازه باید بین ۱ تا ۲۴ ماه باشد.");
  const result = await computeChargeRecommendation(b.id, monthsWindow);
  refresh();
  return result;
}
export async function ensureFirstManager(userId: string) {
  await db.transaction(async (tx) => {
    const users = await tx.select({ id: user.id }).from(user).limit(2);
    const manager = await tx.query.membership.findFirst({
      where: eq(membership.role, "manager"),
    });
    if (users.length !== 1 || users[0]?.id !== userId || manager) return;
    const b = await tx.query.building.findFirst();
    if (!b) throw new Error("ابتدا پایگاه داده ساختمان را راه‌اندازی کنید.");
    await tx.insert(membership).values({
      id: crypto.randomUUID(),
      userId,
      buildingId: b.id,
      role: "manager",
    });
  });
}
export async function linkFirstManager(userId: string) {
  const session = await requireSession();
  if (session.user.id !== userId) throw new Error("دسترسی مجاز نیست.");
  await ensureFirstManager(userId);
}
export async function assignResidentMembership(userId: string, unitId: string) {
  const b = await getManagerBuilding();
  const u = await db.query.unit.findFirst({
    where: and(eq(unit.id, unitId), eq(unit.buildingId, b.id)),
  });
  if (!u || u.deletedAt) throw new Error("واحد پیدا نشد.");
  const existing = await db.query.membership.findFirst({
    where: eq(membership.userId, userId),
  });
  if (
    existing &&
    (existing.role !== "resident" || existing.buildingId !== b.id)
  )
    throw new Error("امکان تغییر نقش یا ساختمان این حساب وجود ندارد.");
  if (existing)
    await db
      .update(membership)
      .set({ unitId })
      .where(eq(membership.id, existing.id));
  else
    await db.insert(membership).values({
      id: crypto.randomUUID(),
      userId,
      buildingId: b.id,
      unitId,
      role: "resident",
    });
  refresh();
}
export async function sendUnitReminder(unitId: string) {
  const b = await getManagerBuilding();
  const members = await db
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.unitId, unitId),
        eq(membership.buildingId, b.id),
        eq(membership.role, "resident"),
      ),
    );
  if (!members.length)
    throw new Error("برای این واحد هنوز حساب ساکن متصل نشده است.");
  for (const m of members)
    await db.insert(appNotification).values({
      id: crypto.randomUUID(),
      userId: m.userId,
      title: "یادآوری پرداخت شارژ",
      body: `لطفاً مانده حساب واحد خود را در بخش فیش‌ها بررسی و پس از واریز، پرداخت را ثبت کنید. ${b.name}`,
    });
  refresh();
}

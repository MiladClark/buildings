import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  maintenanceTicket,
  membership,
  paymentRequest,
  unit,
} from "@/lib/db/schema";
import {
  isoDate,
  formatJalaliMonthLabel,
  jalaliParts,
} from "@/lib/format/jalali";
import { loadSettlementData } from "@/lib/billing/settlement-store";
import { buildSettlementState } from "@/lib/billing/settlement-state";
import { buildingCalendarEvents } from "./calendar";
import { effectiveOccupants } from "@/lib/billing/occupancy";
import { formatAllocationBasis } from "@/lib/format/allocation-basis";
import { unstable_cache } from "next/cache";

import { buildingCacheTag } from "@/lib/cache/building";

const isoDateTime =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function reviveDates<T>(value: T): T {
  if (value instanceof Date) return value;
  if (typeof value === "string" && isoDateTime.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date as T;
  }
  if (Array.isArray(value)) return value.map((item) => reviveDates(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, reviveDates(item)]),
    ) as T;
  }
  return value;
}

async function loadFinanceData(buildingId: string) {
  const [ledger, requests, tickets, residentUnits] = await db.transaction(
    (tx) =>
      Promise.all([
        loadSettlementData(tx, buildingId),
        tx
          .select({ request: paymentRequest, unit })
          .from(paymentRequest)
          .innerJoin(unit, eq(paymentRequest.unitId, unit.id))
          .where(
            and(
              eq(unit.buildingId, buildingId),
              isNull(paymentRequest.deletedAt),
            ),
          )
          .orderBy(desc(paymentRequest.createdAt)),
        tx
          .select()
          .from(maintenanceTicket)
          .where(eq(maintenanceTicket.buildingId, buildingId))
          .orderBy(desc(maintenanceTicket.createdAt)),
        tx
          .select({ unitId: membership.unitId })
          .from(membership)
          .where(
            and(
              eq(membership.buildingId, buildingId),
              eq(membership.role, "resident"),
            ),
          ),
      ]),
  );
  return {
    maintenance: tickets,
    invoiceLines: ledger.lines.map((line) => ({
      ...line,
      basis: formatAllocationBasis(line.basis),
    })),
    residentUnitIds: residentUnits
      .map((r) => r.unitId)
      .filter((id): id is string => !!id),
    units: ledger.units,
    periods: [...ledger.periods].sort(
      (a, b) =>
        b.startDate.getTime() - a.startDate.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    ),
    categories: ledger.categories,
    expenses: [...ledger.expenses]
      .sort((a, b) => b.expenseDate.getTime() - a.expenseDate.getTime())
      .map((expense) => ({
        expense,
        category: ledger.categories.find((c) => c.id === expense.categoryId)!,
      })),
    payments: [...ledger.payments]
      .sort(
        (a, b) =>
          b.paidAt.getTime() - a.paidAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      )
      .map((payment) => ({
        payment,
        unit: ledger.units.find((u) => u.id === payment.unitId)!,
      })),
    invoices: ledger.invoices.map((invoice) => ({
      invoice,
      period: ledger.periods.find((p) => p.id === invoice.periodId)!,
    })),
    requests: requests.map((r) => {
      const confirmed = ledger.payments.find(
        (p) =>
          p.unitId === r.request.unitId &&
          (p.receiptKey === `request:${r.request.id}` ||
            p.receiptKey?.startsWith(`request:${r.request.id}:`)),
      );
      return { ...r, confirmedAmountRial: confirmed?.amountRial ?? null };
    }),
    settings: ledger.settings,
    standaloneExpenses: ledger.standaloneExpenses ?? [],
    settlement: buildSettlementState(ledger),
    applications: ledger.applications,
  };
}

export async function getFinanceData(buildingId: string) {
  try {
    const cached = unstable_cache(
      async () => loadFinanceData(buildingId),
      ["finance-data", buildingId],
      { revalidate: 60, tags: [buildingCacheTag(buildingId)] },
    );
    return reviveDates(await cached());
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Invariant: incrementalCache missing")
    ) {
      return loadFinanceData(buildingId);
    }
    throw error;
  }
}

export type FinanceData = Awaited<ReturnType<typeof loadFinanceData>>;

export function dashboardData(data: FinanceData) {
  const now = new Date();
  const summaries = data.units.map((u) => {
    const invoices = data.invoices.filter((i) => i.invoice.unitId === u.id);
    const payments = data.payments.filter((p) => p.payment.unitId === u.id);
    const account = data.settlement.accounts.find((a) => a.unitId === u.id)!;
    const balance = account.balanceRial;
    const latest = [...invoices].sort(
      (a, b) => b.period.startDate.getTime() - a.period.startDate.getTime(),
    )[0];
    return {
      id: u.id,
      label: u.deletedAt ? `${u.label} (حذف‌شده)` : u.label,
      name: u.tenantName || u.ownerName || "نام ثبت نشده",
      floor: u.floor,
      deleted: !!u.deletedAt,
      canRemind: data.residentUnitIds.includes(u.id),
      occupants: u.deletedAt ? 0 : effectiveOccupants(u),
      temporarilyAbsent: u.temporarilyAbsent,
      occupancy: u.status,
      charge: latest?.invoice.subtotalRial ?? 0,
      paid: payments.reduce((s, p) => s + p.payment.amountRial, 0),
      balance,
      credit: account.creditRial,
      debt: account.debtRial,
      reserved: account.reservedRial,
      invoiceId: latest?.invoice.id ?? null,
      periodId: latest?.period.id ?? null,
      overdue: invoices.some(
        (i) =>
          i.invoice.balanceRial > 0 &&
          i.period.dueDate &&
          isoDate(i.period.dueDate) < isoDate(now),
      ),
    };
  });
  const months = new Map<
    string,
    { id: string; label: string; expense: number; income: number }
  >();
  const bucket = (date: Date) => {
    const { jy, jm } = jalaliParts(date);
    const id = `${jy}-${String(jm).padStart(2, "0")}`;
    if (!months.has(id))
      months.set(id, {
        id,
        label: formatJalaliMonthLabel(date),
        expense: 0,
        income: 0,
      });
    return months.get(id)!;
  };
  for (const row of data.expenses)
    bucket(row.expense.expenseDate).expense += row.expense.amountRial;
  for (const cost of data.standaloneExpenses.filter(
    (c) => !c.deletedAt && !c.linkedExpenseId,
  ))
    bucket(cost.expenseDate).expense += cost.amountRial;
  for (const row of data.payments.filter((r) => r.payment.kind !== "advance"))
    bucket(row.payment.paidAt).income += row.payment.amountRial;
  const timeline = [...months.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  return {
    summaries,
    calendarEvents: buildingCalendarEvents(data),
    timeline,
    periods: data.periods.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      dueDate: p.dueDate?.toISOString() ?? null,
      startDate: p.startDate.toISOString(),
    })),
    expenses: [
      ...data.expenses.map((r) => ({
        id: r.expense.id,
        periodId: r.expense.periodId,
        name: r.category.name,
        slug: r.category.slug,
        amount: r.expense.amountRial,
        date: r.expense.expenseDate.toISOString(),
        description: r.expense.description,
        method: r.category.allocationMethod,
      })),
      ...data.standaloneExpenses
        .filter((c) => !c.deletedAt && !c.linkedExpenseId)
        .map((c) => ({
          id: c.id,
          periodId: null,
          name:
            data.categories.find((category) => category.id === c.categoryId)
              ?.name ?? "هزینه مستقل",
          slug:
            data.categories.find((category) => category.id === c.categoryId)
              ?.slug ?? "independent",
          amount: c.amountRial,
          date: c.expenseDate.toISOString(),
          description: c.description,
          method:
            data.categories.find((category) => category.id === c.categoryId)
              ?.allocationMethod ?? ("per_unit" as const),
        })),
    ],
    payments: data.payments
      .filter((r) => r.payment.kind !== "advance")
      .map((r) => ({
        id: r.payment.id,
        label: r.unit.label,
        name: r.unit.tenantName || r.unit.ownerName || "ساکن ساختمان",
        amount: r.payment.amountRial,
        date: r.payment.paidAt.toISOString(),
        method: r.payment.method,
      })),
    pendingCount: data.requests.filter((r) => r.request.status === "pending")
      .length,
  };
}
export type DashboardData = ReturnType<typeof dashboardData>;

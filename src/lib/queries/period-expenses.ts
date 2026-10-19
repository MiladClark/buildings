import { getSession, getMembershipForUser } from "@/lib/session";
import { getFinanceData } from "./finance";
import { buildPeriodExpensesReport } from "@/lib/export/period-expenses";
import { db } from "@/lib/db";
import { periodChargePlan } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getPeriodExpensesExportData(periodId: string) {
  const session = await getSession();
  if (!session)
    return { ok: false, status: 401, error: "UNAUTHORIZED" } as const;
  const member = await getMembershipForUser(session.user.id);
  if (!member || member.role !== "manager")
    return { ok: false, status: 403, error: "FORBIDDEN" } as const;
  const data = await getFinanceData(member.buildingId);
  const period = data.periods.find(
    (period) =>
      period.id === periodId &&
      period.buildingId === member.buildingId &&
      !period.deletedAt,
  );
  if (!period || !data.settings)
    return { ok: false, status: 404, error: "NOT_FOUND" } as const;
  const plan = await db.query.periodChargePlan.findFirst({
    where: eq(periodChargePlan.periodId, period.id),
  });
  return {
    ok: true,
    data: buildPeriodExpensesReport({
      buildingName: data.settings.name,
      manualMonthlyRial: plan?.manualMonthlyRial ?? null,
      period,
      expenses: data.expenses.map(({ expense, category }) => ({
        ...expense,
        category: category.name,
      })),
    }),
  } as const;
}

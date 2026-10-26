import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { db } = await import("../src/lib/db");
  const { getFinanceData } = await import("../src/lib/queries/finance");
  const building = await db.query.building.findFirst();
  if (!building) return;
  const data = await getFinanceData(building.id);
  const policies = await db.query.chargeBudgetPolicy.findMany();
  const plans = await db.query.periodChargePlan.findMany();
  console.log(
    JSON.stringify(
      {
        unitCount: data.units.filter((u) => !u.deletedAt).length,
        occupants: data.units
          .filter((u) => !u.deletedAt && !u.temporarilyAbsent)
          .reduce((s, u) => s + u.occupantCount, 0),
        periods: data.periods.map((p) => ({
          id: p.id,
          start: p.startDate,
          end: p.endDate,
          status: p.status,
        })),
        categories: data.categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          method: c.allocationMethod,
          active: c.active,
        })),
        expenses: data.expenses.map(({ expense: e, category: c }) => ({
          id: e.id,
          category: c.name,
          description: e.description,
          amount: e.amountRial,
          date: e.expenseDate,
          coverage: e.coverageMonths,
          periodId: e.periodId,
        })),
        independent: data.standaloneExpenses
          .filter((e) => !e.deletedAt && !e.linkedExpenseId)
          .map((e) => ({
            id: e.id,
            categoryId: e.categoryId,
            description: e.description,
            amount: e.amountRial,
            date: e.expenseDate,
          })),
        policies,
        plans,
      },
      null,
      2,
    ),
  );
}
main().catch(console.error);

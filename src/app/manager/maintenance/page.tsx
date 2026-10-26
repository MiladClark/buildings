import { MaintenanceView } from "@/components/finance/maintenance";
import { getFinanceData } from "@/lib/queries/finance";
import { requireManager } from "@/lib/session";
export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const { member } = await requireManager();
  const data = await getFinanceData(member.buildingId);
  const query = await searchParams;
  return (
    <MaintenanceView
      key={query.ticket ?? "list"}
      manager
      focusId={query.ticket}
      tickets={data.maintenance
        .filter((t) => !t.deletedAt)
        .map((t) => ({
          ...t,
          date: t.createdAt.toISOString(),
          scheduled: t.scheduledAt?.toISOString() ?? null,
          costs: [
            ...data.expenses
              .filter((e) => e.expense.maintenanceTicketId === t.id)
              .map((e) => ({
                id: e.expense.id,
                amount: e.expense.amountRial,
                periodId: e.expense.periodId,
                title: e.expense.description || e.category.name,
              })),
            ...data.standaloneExpenses
              .filter(
                (c) =>
                  !c.deletedAt &&
                  !c.linkedExpenseId &&
                  c.maintenanceTicketId === t.id,
              )
              .map((c) => ({
                id: c.id,
                amount: c.amountRial,
                title: `${c.description} · مستقل`,
                href: `/manager/expenses/independent/${c.id}`,
              })),
          ],
        }))}
    />
  );
}

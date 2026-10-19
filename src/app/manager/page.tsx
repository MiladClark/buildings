import { Dashboard } from "@/components/finance/dashboard";
import { dashboardData, getFinanceData } from "@/lib/queries/finance";
import { requireManager } from "@/lib/session";
export default async function ManagerDashboardPage() {
  const { session, member } = await requireManager();
  const data = await getFinanceData(member.buildingId);
  return <Dashboard data={dashboardData(data)} name={session.user.name} />;
}

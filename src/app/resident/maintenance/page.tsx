import { MaintenanceView } from "@/components/finance/maintenance";
import { listMaintenance } from "@/lib/actions/maintenance";
export default async function MaintenancePage() {
  const data = await listMaintenance(true);
  return (
    <MaintenanceView
      manager={false}
      tickets={data.map((t) => ({
        ...t,
        date: t.createdAt.toISOString(),
        scheduled: t.scheduledAt?.toISOString() ?? null,
      }))}
    />
  );
}

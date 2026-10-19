import { getManagementHistory } from "@/lib/actions/management";
import { ManagementHistory } from "@/components/finance/management-history";
export default async function HistoryPage() {
  const { events, trash } = await getManagementHistory();
  return (
    <ManagementHistory
      trash={trash}
      events={events.map((e) => ({ ...e, date: e.createdAt.toISOString() }))}
    />
  );
}

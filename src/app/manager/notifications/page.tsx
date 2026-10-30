import { NotificationsPage } from "@/components/notifications/page";
import { requireManager } from "@/lib/session";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireManager();
  return <NotificationsPage tab={(await searchParams).tab} />;
}

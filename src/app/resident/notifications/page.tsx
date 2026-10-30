import { NotificationsPage } from "@/components/notifications/page";
import { requireSession } from "@/lib/session";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireSession();
  return <NotificationsPage tab={(await searchParams).tab} />;
}

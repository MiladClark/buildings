import { NotificationsPage } from "@/components/notifications/page";
import { requireSession } from "@/lib/session";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireSession();
  return <NotificationsPage resident tab={(await searchParams).tab} />;
}

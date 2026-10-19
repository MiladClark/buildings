import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getBuildingForUser } from "@/lib/queries/dashboard";
import { getSession } from "@/lib/session";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const ctx = await getBuildingForUser(session.user.id);
  if (!ctx || ctx.membership.role !== "manager") {
    redirect("/resident");
  }

  return (
    <AppShell
      role="manager"
      title={ctx.building.name}
      userName={session.user.name}
    >
      {children}
    </AppShell>
  );
}

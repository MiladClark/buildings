import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getBuildingForUser } from "@/lib/queries/dashboard";
import { getSession } from "@/lib/session";

export default async function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const ctx = await getBuildingForUser(session.user.id);
  if (!ctx) redirect("/pending");
  if (ctx.membership.role === "manager" && !ctx.membership.unitId)
    redirect("/manager/account#my-unit");

  return (
    <AppShell
      role="resident"
      title={ctx.building.name}
      userName={session.user.name}
      managerAccess={ctx.membership.role === "manager"}
    >
      {children}
    </AppShell>
  );
}

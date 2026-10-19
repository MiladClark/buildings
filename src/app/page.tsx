import { redirect } from "next/navigation";

import { getBuildingForUser } from "@/lib/queries/dashboard";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const ctx = await getBuildingForUser(session.user.id);
  if (!ctx) {
    redirect("/pending");
  }

  if (ctx.membership.role === "manager") {
    redirect("/manager");
  }

  redirect("/resident");
}

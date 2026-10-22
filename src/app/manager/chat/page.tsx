import { BuildingChat } from "@/components/chat/building-chat";
import { getBuildingForUser } from "@/lib/queries/dashboard";
import { requireManager } from "@/lib/session";

export default async function ManagerChatPage() {
  const { session } = await requireManager();
  const context = await getBuildingForUser(session.user.id);
  if (!context) throw new Error("FORBIDDEN");

  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>گفتگوی ساختمان</h1>
          <p>
            گفتگوی مشترک مدیر و ساکنان؛ مدیر می‌تواند پیام‌های نامناسب را مدیریت
            کند.
          </p>
        </div>
      </div>
      <BuildingChat buildingName={context.building.name} />
    </div>
  );
}

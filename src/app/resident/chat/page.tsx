import { BuildingChat } from "@/components/chat/building-chat";
import { listChatMessages } from "@/lib/chat";
import { getBuildingForUser } from "@/lib/queries/dashboard";
import { requireResident } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ResidentChatPage() {
  const { session, member } = await requireResident();
  const context = await getBuildingForUser(session.user.id);
  if (!context) throw new Error("FORBIDDEN");

  const initialMessages = await listChatMessages({ session, member });

  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <h1>گفتگوی ساختمان</h1>
          <p>
            فضای مشترک ساکنان برای هماهنگی‌ها، اطلاع‌رسانی‌ها و گفت‌وگوی روزمره.
          </p>
        </div>
      </div>
      <BuildingChat
        buildingName={context.building.name}
        initialMessages={initialMessages}
      />
    </div>
  );
}

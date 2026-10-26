import { BuildingChat } from "@/components/chat/building-chat";
import { listChatMembers, listChatMessages } from "@/lib/chat";
import { getBuildingForUser } from "@/lib/queries/dashboard";
import { requireResident } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ResidentChatPage() {
  const { session, member } = await requireResident();
  const context = await getBuildingForUser(session.user.id);
  if (!context) throw new Error("FORBIDDEN");

  const chatContext = { session, member };
  const [initialMessages, initialMembers] = await Promise.all([
    listChatMessages(chatContext),
    listChatMembers(chatContext),
  ]);

  return (
    <div className="lg:space-y-6">
      <div className="page-heading hidden lg:block">
        <div>
          <h1>گفتگوی ساختمان</h1>
          <p>
            فضای مشترک ساکنان برای هماهنگی‌ها، اطلاع‌رسانی‌ها و گفت‌وگوی روزمره.
          </p>
        </div>
      </div>
      <BuildingChat
        buildingId={context.building.id}
        buildingName={context.building.name}
        initialMessages={initialMessages}
        initialMembers={initialMembers}
      />
    </div>
  );
}

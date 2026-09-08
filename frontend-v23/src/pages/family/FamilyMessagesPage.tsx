import { PageHeader } from "@/components/ui";
import { RealMessagingPanel } from "@/features/messaging/ConversationUI";

export function FamilyMessagesPage() {
  return (
    <div>
      <PageHeader title="Mensajes" description="Comunicación sobre el cuidado de Carmen." />
      <RealMessagingPanel />
    </div>
  );
}

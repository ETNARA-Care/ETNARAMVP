import { MessageCircle } from "lucide-react";
import { RealMessagingPanel } from "@/features/messaging/ConversationUI";

export function FamilyMessagesPage() {
  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-medium text-[#66845f]">Mensajes</p>
        <h1 className="mt-1 font-display text-[2rem] leading-tight text-[#102b57]">Comunicación de cuidado</h1>
        <p className="mt-1 text-sm text-[#667085]">Mantente en contacto dentro de las conversaciones autorizadas por tu organización.</p>
      </section>
      <section className="rounded-[22px] bg-[#102b57] p-5 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[#b8c9ad]"><MessageCircle size={21} /></div>
          <div><p className="font-medium">Tu espacio de comunicación</p><p className="mt-0.5 text-sm text-white/70">Mensajes relacionados con el cuidado de tu familiar.</p></div>
        </div>
      </section>
      <RealMessagingPanel conversationTitle="Equipo de cuidado" />
    </div>
  );
}

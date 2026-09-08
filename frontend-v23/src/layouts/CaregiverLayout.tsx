import { Outlet } from "react-router-dom";
import { CalendarClock, MessageCircle, User } from "lucide-react";
import { TopHeader } from "./TopHeader";
import { MobileTabBar } from "./MobileTabBar";
import { DEMO_IDENTITIES } from "@/mocks/seed";

// Rutas alineadas exactamente a las definidas en el brief de Fase 2:
// /caregiver/shifts, /caregiver/shifts/:shiftId, /caregiver/messages, /caregiver/profile
export function CaregiverLayout() {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopHeader title="ETNARA Care" userName="María Rivera" participantId={DEMO_IDENTITIES.caregiverId} />
      <main className="flex-1 max-w-[560px] w-full mx-auto px-[var(--spacing-md)] py-[var(--spacing-md)] pb-24">
        <Outlet />
      </main>
      <MobileTabBar
        items={[
          { to: "/caregiver/shifts", icon: <CalendarClock size={22} />, label: "Turnos" },
          { to: "/caregiver/messages", icon: <MessageCircle size={22} />, label: "Mensajes" },
          { to: "/caregiver/profile", icon: <User size={22} />, label: "Perfil" },
        ]}
      />
    </div>
  );
}

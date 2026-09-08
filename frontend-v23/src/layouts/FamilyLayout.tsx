import { Outlet } from "react-router-dom";
import { Home, Activity, Clock, MessageCircle, User } from "lucide-react";
import { TopHeader } from "./TopHeader";
import { MobileTabBar } from "./MobileTabBar";
import { DEMO_IDENTITIES } from "@/mocks/seed";

export function FamilyLayout() {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopHeader title="ETNARA Care" userName="Ana Rivera" participantId={DEMO_IDENTITIES.familyMemberId} />
      <main className="flex-1 max-w-[560px] w-full mx-auto px-[var(--spacing-md)] py-[var(--spacing-md)] pb-24">
        <Outlet />
      </main>
      <MobileTabBar
        items={[
          { to: "/family/today", icon: <Home size={22} />, label: "Hoy" },
          { to: "/family/activity", icon: <Activity size={22} />, label: "Actividad" },
          { to: "/family/history", icon: <Clock size={22} />, label: "Historial" },
          { to: "/family/messages", icon: <MessageCircle size={22} />, label: "Mensajes" },
          { to: "/family/profile", icon: <User size={22} />, label: "Perfil" },
        ]}
      />
    </div>
  );
}

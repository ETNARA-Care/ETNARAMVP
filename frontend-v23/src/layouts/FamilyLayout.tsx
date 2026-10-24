import { Outlet } from "react-router-dom";
import { Home, HeartPulse, CalendarDays, MessageCircle, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { PortalBottomNav } from "./PortalBottomNav";
import { AccountMenu } from "./AccountMenu";
import { FamilyRecipientProvider, FamilyRecipientSwitcher } from "@/features/family/FamilyRecipientContext";

export function FamilyLayout() {
  const { user, organizations, logout } = useAuth();
  return (
    <FamilyRecipientProvider>
    <div data-portal="family" className="min-h-dvh flex flex-col bg-[#f8f5ee] text-[#173154]">
      <header className="sticky top-0 z-[var(--z-header)] border-b border-[#173154]/10 bg-[#f8f5ee]/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[760px] items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}etnara-mark.svg`} alt="" className="h-9 w-9 rounded-[10px]" />
            <span className="whitespace-nowrap leading-none">
              <span className="font-display text-[1.2rem] font-semibold tracking-[0.04em] text-[#102b57]">ETNARA</span>
              <span className="ml-1.5 font-display text-[1.2rem] italic text-[#66845f]">Care</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <AccountMenu userLabel={user?.email ?? "Familia"} roleLabel="Familia" settingsTo="/family/profile" onLogout={logout}
              canSwitchOrganization={organizations.length > 1} showDetailsFrom="never" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-5 pb-28 md:px-6 md:py-7">
        <FamilyRecipientSwitcher />
        <Outlet />
      </main>
      <PortalBottomNav tabs={[
        { to: "/family/today", icon: Home, label: "Inicio" },
        { to: "/family/activity", icon: HeartPulse, label: "Cuidado" },
        { to: "/family/history", icon: CalendarDays, label: "Calendario" },
        { to: "/family/messages", icon: MessageCircle, label: "Mensajes" },
        { to: "/family/profile", icon: MoreHorizontal, label: "Más" },
      ]} />
    </div>
    </FamilyRecipientProvider>
  );
}

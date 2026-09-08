import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard, Users, UserCog, CalendarRange, AlertTriangle,
  MessageCircle, ShieldCheck, Settings, Menu, X,
} from "lucide-react";
import { Avatar, IconButton, NavigationItem } from "@/components/ui";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { DEMO_IDENTITIES } from "@/mocks/seed";

// Rutas alineadas exactamente a las definidas en el brief de Fase 2 --
// no se agregó /agency/reports porque no estaba en la lista de rutas dada.
const NAV = [
  { to: "/agency", end: true, icon: <LayoutDashboard size={18} />, label: "Overview" },
  { to: "/agency/residents", icon: <Users size={18} />, label: "Residentes" },
  { to: "/agency/workers", icon: <UserCog size={18} />, label: "Cuidadores" },
  { to: "/agency/shifts", icon: <CalendarRange size={18} />, label: "Turnos" },
  { to: "/agency/incidents", icon: <AlertTriangle size={18} />, label: "Incidentes", badge: 2 },
  { to: "/agency/messages", icon: <MessageCircle size={18} />, label: "Mensajes" },
  { to: "/agency/compliance", icon: <ShieldCheck size={18} />, label: "Cumplimiento" },
  { to: "/agency/settings", icon: <Settings size={18} />, label: "Configuración" },
];

function SidebarContent() {
  return (
    <div className="flex flex-col h-full">
      <Link to="/agency" className="flex items-center gap-2 px-3 h-16">
        <span className="font-display text-[var(--text-h3)] text-white">ETNARA</span>
        <span className="text-[var(--text-caption)] text-white/60 font-medium uppercase tracking-wide">Agencia</span>
      </Link>
      <nav className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
        {NAV.map((item) => (
          <NavigationItem key={item.to} {...item} />
        ))}
      </nav>
      <div className="p-3 border-t border-white/10 flex items-center gap-2.5">
        <Avatar name="Residencial Los Almendros" size={36} />
        <div className="min-w-0">
          <p className="text-[var(--text-small)] font-medium text-white truncate">Los Almendros</p>
          <p className="text-[var(--text-caption)] text-white/60 truncate">Organización activa</p>
        </div>
      </div>
    </div>
  );
}

export function AgencyLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh md:flex bg-[var(--color-bg)]">
      {/* Sidebar desktop */}
      <aside className="hidden md:block w-64 shrink-0 bg-[var(--color-navy-950)]">
        <div className="fixed w-64 h-dvh">
          <SidebarContent />
        </div>
      </aside>

      {/* Drawer móvil */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[var(--z-overlay)] md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="absolute left-0 top-0 h-full w-72 bg-[var(--color-navy-950)]">
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-[var(--z-header)] flex items-center justify-between h-16 px-[var(--spacing-md)]
          bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <IconButton
            icon={drawerOpen ? <X size={20} /> : <Menu size={20} />}
            label="Abrir menú"
            className="md:hidden"
            onClick={() => setDrawerOpen((v) => !v)}
          />
          <span className="hidden md:block text-[var(--text-body)] text-[var(--color-text-secondary)]">
            Residencial Los Almendros
          </span>
          <div className="flex items-center gap-3">
            <NotificationBell participantId={DEMO_IDENTITIES.agencyAdminId} />
            <Avatar name="Rafael Vega" size={32} />
          </div>
        </header>
        <main className="p-[var(--spacing-md)] md:p-[var(--spacing-lg)] max-w-[1200px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

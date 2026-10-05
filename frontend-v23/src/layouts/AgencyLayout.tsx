import { Outlet } from "react-router-dom";
import { LayoutDashboard, Users, UserCog, CalendarRange, AlertTriangle, BadgeCheck, Bot, MessageCircle, ShieldCheck, Settings, TrendingUp, DollarSign, Siren, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { AdminSidebar, AdminSideLink } from "@/layouts/admin/AdminSidebar";
import { AdminTopbar } from "@/layouts/admin/AdminTopbar";
import { AdminMobileNav } from "@/layouts/admin/AdminMobileNav";
import type { AdminNavGroup, AdminNavItem } from "@/layouts/admin/adminNav";
/* Navegación del Portal Administrativo. Solo rutas que ya existen en App.tsx. */
const OPERATION: AdminNavItem[] = [
 { to: "/agency", end: true, icon: LayoutDashboard, label: "Resumen" },
 { to: "/agency/compliance", icon: ShieldCheck, label: "Compliance" },
 { to: "/agency/workers", icon: UserCog, label: "Personal" },
 { to: "/agency/shifts", icon: CalendarRange, label: "Turnos" },
 { to: "/agency/planning", icon: TrendingUp, label: "Planificación" },
 { to: "/agency/timesheets", icon: DollarSign, label: "Horas y facturación" },
 { to: "/agency/operations", icon: Siren, label: "Centro operacional" },
];
const CARE: AdminNavItem[] = [
 { to: "/agency/residents", icon: Users, label: "Residentes" },
 { to: "/agency/quality", icon: ClipboardCheck, label: "Calidad del cuidado" },
 { to: "/agency/incidents", icon: AlertTriangle, label: "Incidentes" },
 { to: "/agency/messages", icon: MessageCircle, label: "Mensajes" },
];
const ADMINISTRATION: AdminNavItem[] = [
 { to: "/agency/agents", icon: Bot, label: "Centro de agentes" },
 { to: "/agency/settings", icon: Settings, label: "Configuración" },
];
const GROUPS: AdminNavGroup[] = [
 { label: "Operación", items: OPERATION },
 { label: "Cuidado", items: CARE },
 { label: "Administración", items: ADMINISTRATION },
];
/** Pestañas fijas en móvil; el resto vive en la hoja “Más”. */
const MOBILE_TABS: AdminNavItem[] = [
 { to: "/agency", end: true, icon: LayoutDashboard, label: "Inicio" },
 { to: "/agency/compliance", icon: ShieldCheck, label: "Compliance" },
 { to: "/agency/shifts", icon: CalendarRange, label: "Turnos" },
 { to: "/agency/residents", icon: Users, label: "Residentes" },
];

export function AgencyLayout() {
 const { activeOrganization, organizations, user, isPlatformAdmin, logout } = useAuth();
 const organizationName = activeOrganization?.name ?? "Organización";
 // Acceso a Plataforma ETNARA: solo administradores de plataforma, separado del administrador de la organización.
 const platformLink = isPlatformAdmin ? <AdminSideLink to="/platform" icon={BadgeCheck} label="Plataforma" /> : null;

 return (
 <div data-portal="admin" className="flex min-h-dvh">
 <AdminSidebar groups={GROUPS} platformLink={platformLink} organizationName={organizationName} />
 <div className="min-w-0 flex-1">
 <AdminTopbar organizationName={organizationName} canSwitchOrganization={organizations.length > 1}
 userLabel={user?.email ?? "Administrador"} onLogout={logout} />
 <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
 <Outlet />
 </main>
 </div>
 <AdminMobileNav tabs={MOBILE_TABS} groups={GROUPS} platformLink={platformLink} />
 </div>
 );
}

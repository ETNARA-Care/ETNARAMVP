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
export function AgencyLayout(){const[drawerOpen,setDrawerOpen]=useState(false);const{activeOrganization,user}=useAuth();return <div className="min-h-dvh bg-[radial-gradient(circle_at_85%_0%,rgba(62,107,75,0.08),transparent_26rem),var(--color-bg)] md:flex"><aside className="hidden w-64 shrink-0 bg-[linear-gradient(180deg,var(--color-navy-950),#111c36)] md:block"><div className="fixed h-dvh w-64"><SidebarContent/></div></aside>{drawerOpen&&<div className="fixed inset-0 z-[var(--z-overlay)] md:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setDrawerOpen(false)} aria-hidden/><div className="absolute left-0 top-0 h-full w-[min(88vw,18rem)] bg-[var(--color-navy-950)] shadow-xl"><SidebarContent onNavigate={()=>setDrawerOpen(false)}/></div></div>}<div className="min-w-0 flex-1"><header className="sticky top-0 z-[var(--z-header)] flex h-16 items-center justify-between border-b border-white/60 bg-white/85 px-[var(--spacing-md)] shadow-[0_1px_18px_rgba(22,33,61,0.05)] backdrop-blur-xl"><div className="flex min-w-0 items-center gap-3"><IconButton icon={drawerOpen?<X size={20}/>:<Menu size={20}/>} label={drawerOpen?"Cerrar menú":"Abrir menú"} className="md:hidden" onClick={()=>setDrawerOpen(v=>!v)}/><div className="min-w-0"><p className="truncate text-[var(--text-small)] font-medium text-[var(--color-text-primary)] md:text-[var(--text-body)]">{activeOrganization?.name??"Organización"}</p><p className="hidden text-[var(--text-caption)] text-[var(--color-text-muted)] sm:block">Espacio administrativo</p></div></div><div className="flex items-center gap-3"><NotificationBell/><Avatar name={user?.email??"Administrador"} size={32}/></div></header><main className="mx-auto max-w-[1280px] p-[var(--spacing-md)] md:px-8 md:py-7 lg:px-10"><Outlet/></main></div></div>}

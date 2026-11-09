import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { usePhotoMode } from "@/features/activityPhotos/usePhotoMode";
import { useTranslation } from "react-i18next";
import { Camera, HeartHandshake, LayoutDashboard, Users, UserCog, CalendarRange, AlertTriangle, BadgeCheck, Bot, MessageCircle, ShieldCheck, Settings, TrendingUp, DollarSign, Siren, ClipboardCheck, BriefcaseBusiness, Landmark, FileSignature } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { hasOrgFeature } from "@/auth/orgFeatures";
import { contractOnlyRedirect, useContractsAvailable } from "@/features/contracts/useContractsAvailable";
import { AdminSidebar, AdminSideLink } from "@/layouts/admin/AdminSidebar";
import { AdminTopbar } from "@/layouts/admin/AdminTopbar";
import { AdminMobileNav } from "@/layouts/admin/AdminMobileNav";
import type { AdminNavGroup, AdminNavItem } from "@/layouts/admin/adminNav";
/* Navegación del Portal Administrativo. Solo rutas que ya existen en App.tsx. */
// Labels are catalog keys (shell:agency.items.*); translated when rendered.
type NavKey = Omit<AdminNavItem, "label"> & { k: "overview" | "home" | "compliance" | "workers" | "shifts" | "smartmatch" | "planning" | "timesheets" | "finance" | "operations" | "residents" | "quality" | "incidents" | "photos" | "messages" | "agents" | "settings" | "contracts" };
const OPERATION: NavKey[] = [
 { to: "/agency", end: true, icon: LayoutDashboard, k: "overview" },
 { to: "/agency/compliance", icon: ShieldCheck, k: "compliance" },
 { to: "/agency/workers", icon: UserCog, k: "workers" },
 { to: "/agency/shifts", icon: CalendarRange, k: "shifts" },
 { to: "/agency/smartmatch", icon: BriefcaseBusiness, k: "smartmatch" },
 { to: "/agency/planning", icon: TrendingUp, k: "planning" },
 { to: "/agency/timesheets", icon: DollarSign, k: "timesheets" },
 { to: "/agency/finance", icon: Landmark, k: "finance" },
 { to: "/agency/operations", icon: Siren, k: "operations" },
];
const CARE: NavKey[] = [
 { to: "/agency/residents", icon: Users, k: "residents" },
 { to: "/agency/quality", icon: ClipboardCheck, k: "quality" },
 { to: "/agency/incidents", icon: AlertTriangle, k: "incidents" },
 { to: "/agency/photos", icon: Camera, k: "photos" },
 { to: "/agency/messages", icon: MessageCircle, k: "messages" },
];
const ADMINISTRATION: NavKey[] = [
 { to: "/agency/agents", icon: Bot, k: "agents" },
 { to: "/agency/settings", icon: Settings, k: "settings" },
 // Módulo contractual (Etapa 2): solo administración y solo con el módulo encendido en el servidor.
 { to: "/agency/contracts", icon: FileSignature, k: "contracts" },
];
const GROUPS: Array<{ k: "operation" | "care" | "administration"; items: NavKey[] }> = [
 { k: "operation", items: OPERATION },
 { k: "care", items: CARE },
 { k: "administration", items: ADMINISTRATION },
];
/** Pestañas fijas en móvil; el resto vive en la hoja “Más”. */
const MOBILE_TABS: NavKey[] = [
 { to: "/agency", end: true, icon: LayoutDashboard, k: "home" },
 { to: "/agency/compliance", icon: ShieldCheck, k: "compliance" },
 { to: "/agency/shifts", icon: CalendarRange, k: "shifts" },
 { to: "/agency/residents", icon: Users, k: "residents" },
];

export function AgencyLayout() {
 const { activeOrganization, organizations, user, isPlatformAdmin, logout, roles } = useAuth();
 const { t } = useTranslation("shell");
 const toNav = ({ k, ...rest }: NavKey): AdminNavItem => ({ ...rest, label: t(`agency.items.${k}`) });
 // Horas y facturación y SmartMatch: solo administradores (backend 085/096). El supervisor no ve los enlaces.
 // SmartMatch además solo para la agencia piloto (backend 108).
 const smartMatch = hasOrgFeature(activeOrganization?.features, "SMARTMATCH");
 // Finanzas (119): solo administradores y solo con FINANZAS activado por ETNARA central.
 const finance = hasOrgFeature(activeOrganization?.features, "FINANZAS");
 // Fotos de actividades (E2): solo con ACTIVITY_PHOTOS y solo administración y supervisión (D5-B).
 // 145 (§5): con el módulo apagado, la administración conserva la entrada si hay retenciones legales que revisar.
 const photoMode = usePhotoMode();
 const photos = photoMode === "full" || photoMode === "legal-review";
 const contracts = useContractsAvailable(activeOrganization?.id, roles.includes("ORGANIZATION_ADMIN"));
 const location = useLocation();
 const groups: AdminNavGroup[] = GROUPS.map((group) => ({ label: t(`agency.groups.${group.k}`), items: group.items.filter((item) =>
   (roles.includes("ORGANIZATION_ADMIN") || (item.to !== "/agency/timesheets" && item.to !== "/agency/smartmatch" && item.to !== "/agency/finance"))
   && (smartMatch || item.to !== "/agency/smartmatch")
   && (finance || item.to !== "/agency/finance")
   && (photos || item.to !== "/agency/photos")
   && (contracts.available || item.to !== "/agency/contracts")).map((item) => {
     const nav = toNav(item);
     return item.k === "contracts" && contracts.pending > 0 ? { ...nav, label: `${nav.label} (${contracts.pending})` } : nav;
   }) }));
 const organizationName = activeOrganization?.name ?? t("agency.organizationFallback");
 // Acceso a Plataforma ETNARA: solo administradores de plataforma, separado del administrador de la organización.
 const platformLink = isPlatformAdmin || roles.includes("WORKER")
   ? <>
       {isPlatformAdmin && <AdminSideLink to="/platform" icon={BadgeCheck} label={t("agency.platform")} />}
       {roles.includes("WORKER") && <AdminSideLink to="/caregiver/today" icon={HeartHandshake} label={t("agency.myCaregiverDay")} />}
     </>
   : null;

 return (
 <div data-portal="admin" className="flex min-h-dvh">
 <AdminSidebar groups={groups} platformLink={platformLink} organizationName={organizationName} />
 <div className="min-w-0 flex-1">
 <AdminTopbar organizationName={organizationName} canSwitchOrganization={organizations.length > 1}
 userLabel={user?.email ?? t("agency.adminFallback")} onLogout={logout} />
 <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
 {contracts.status?.notice && !location.pathname.startsWith("/agency/contracts") && (
   <Link to="/agency/contracts" data-testid="contracts-notice-banner" className="mb-4 block rounded-[var(--radius-sm)] border border-[var(--color-warning-700)]/40 bg-[var(--color-warning-100)] px-4 py-3 text-[var(--text-small)] font-medium text-[var(--color-warning-700)]">
     {t("agency.contractsPendingNotice")}
   </Link>
 )}
 {contractOnlyRedirect(contracts.status, location.pathname) ? <Navigate to="/agency/contracts" replace /> : <Outlet />}
 </main>
 </div>
 <AdminMobileNav tabs={MOBILE_TABS.map(toNav)} groups={groups} platformLink={platformLink} />
 </div>
 );
}

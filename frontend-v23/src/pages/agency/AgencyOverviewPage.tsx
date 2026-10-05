import { AlertTriangle, CalendarPlus, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { ErrorState, Skeleton } from "@/components/ui";
import { isToday, useAgencySupervision } from "@/features/agency/useAgencySupervision";
import { useOperationsCenter } from "@/features/agency/useOperationsCenter";
import { useResidentCompliance } from "@/features/agency/useResidentCompliance";
import { Briefing } from "./overview/Briefing";
import { AttentionQueue } from "./overview/AttentionQueue";
import { ReadinessPanel } from "./overview/ReadinessPanel";
import { ShiftBoard } from "./overview/ShiftBoard";
import { WorkforcePanel } from "./overview/WorkforcePanel";
import { ExpiringDocuments } from "./overview/ExpiringDocuments";
import { ResidentsPanel } from "./overview/ResidentsPanel";
import { IncidentsPanel } from "./overview/IncidentsPanel";
import { ActivityFeed } from "./overview/ActivityFeed";
function DashboardAction({ label, Icon, to, primary = false, onNavigate }: { label: string; Icon: typeof CalendarPlus; to: string; primary?: boolean; onNavigate: (to: string) => void }) {
 return (
 <button type="button" onClick={() => onNavigate(to)}
 className={`flex min-h-12 min-w-0 items-center gap-3 rounded-[12px] border px-3.5 py-2.5 text-left text-sm transition-colors ${primary ? "border-[var(--color-navy-900)] bg-[var(--color-navy-900)] text-white hover:bg-[var(--color-navy-800)]" : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]/25"}`}>
 <Icon size={18} strokeWidth={1.75} className="shrink-0" aria-hidden />
 <span className="min-w-0 leading-tight">{label}</span>
 </button>
 );
  return typeof value === "string" ? value : null;
const QUICK_ACTIONS = [
 { label: "Crear turno", Icon: CalendarPlus, to: "/agency/shifts?create=1", primary: true },
 { label: "Revisar Compliance", Icon: ShieldCheck, to: "/agency/compliance" },
 { label: "Personal", Icon: UserPlus, to: "/agency/workers" },
 { label: "Residentes", Icon: Users, to: "/agency/residents" },
 { label: "Incidentes", Icon: AlertTriangle, to: "/agency/incidents" },
];
/** Centro de mando del Portal Administrativo: todo con datos reales de la organización activa. */
export function AgencyOverviewPage() {
 const navigate = useNavigate();
 const { activeOrganization } = useAuth();
 const supervision = useAgencySupervision();
 const operations = useOperationsCenter();
 const compliance = useResidentCompliance();
 if (supervision.loading) return <div className="grid gap-4"><Skeleton className="h-32" /><Skeleton className="h-72" /><Skeleton className="h-56" /></div>;
 if (supervision.error) return <ErrorState kind="server" onRetry={() => void supervision.reload()} />;
 const todayShifts = supervision.shifts.filter((s) => isToday(s.scheduled_start));
 const todayEvents = supervision.events.filter((e) => isToday(e.occurred_at));
 const alerts = operations.data?.alerts ?? [];
 const credentialAlerts = alerts.filter((a) => a.category === "expiring_credential");
 const activeRecipients = supervision.recipients.filter((r) => r.status === "active").length;
 return (
 <div className="space-y-6 lg:space-y-8">
 <Briefing organizationName={activeOrganization?.name ?? "tu organización"} center={operations.data} centerLoading={operations.loading} centerError={operations.error}
 todayShifts={todayShifts} recipients={activeRecipients} careEventsToday={todayEvents.length} />
 <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
 <AttentionQueue center={operations.data} loading={operations.loading} error={operations.error} onRetry={() => void operations.reload()} className="xl:col-span-8" />
 <ReadinessPanel rows={compliance.rows} places={compliance.places} error={compliance.error} credentialAlerts={credentialAlerts.length} className="xl:col-span-4" />
 <ShiftBoard shifts={todayShifts} onCreate={() => navigate("/agency/shifts?create=1")} className="xl:col-span-12" />
 <WorkforcePanel workers={supervision.workers} todayShifts={todayShifts} alerts={alerts} className="xl:col-span-4" />
 <ExpiringDocuments rows={compliance.rows} credentialAlerts={credentialAlerts} className="xl:col-span-8" />
 <ResidentsPanel recipients={activeRecipients} rows={compliance.rows} places={compliance.places} className="xl:col-span-4" />
 <IncidentsPanel alerts={alerts} className="xl:col-span-4" />
 <div className="grid content-start gap-6 xl:col-span-4">
 <section className="min-w-0">
 <h2 className="font-display text-[1.3rem] text-[var(--color-text-primary)]">Acciones rápidas</h2>
 <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
 {QUICK_ACTIONS.map(({ label, Icon, to, primary }) => <DashboardAction key={label} label={label} Icon={Icon} to={to} primary={primary} onNavigate={navigate} />)}
 </div>
 </section>
 </div>
 <ActivityFeed events={todayEvents} className="xl:col-span-12" />
 </div>
        {recent.length?<ul className="mt-3 divide-y divide-[#e5dfd2] border-t border-[#e5dfd2]">{recent.map(e=><li key={e.id} className="px-5 py-3.5 sm:px-6"><div className="flex items-start gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#567a60]"/><div className="min-w-0"><p className="text-sm font-medium text-[#17202e]">{eventLabel[e.type_code]??"Registro de cuidado"}</p>{eventDetail(e)&&<p className="mt-0.5 truncate text-sm text-[#545e6e]">{eventDetail(e)}</p>}<p className="mt-1 text-xs text-[#808894]">{new Intl.DateTimeFormat("es-PR",{hour:"numeric",minute:"2-digit"}).format(new Date(e.occurred_at))}</p></div></div></li>)}</ul>:<div className="p-5"><EmptyState title="Sin actividad reciente" description="Los registros de cuidado de hoy aparecerán aquí."/></div>}
 );

      <div className="xl:col-span-12"><p className="mb-3 text-xs font-semibold uppercase tracking-[.14em] text-[#808894]">Acciones rápidas</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([{label:"Crear turno",Icon:CalendarPlus,to:"/agency/shifts?create=1"},{label:"Personal",Icon:UserPlus,to:"/agency/workers"},{label:"Residentes",Icon:Users,to:"/agency/residents"},{label:"Incidentes",Icon:AlertTriangle,to:"/agency/incidents"}]).map(({label,Icon,to})=><DashboardAction key={label} label={label} Icon={Icon} to={to} onNavigate={navigate}/>)}
      </div></div>
    </div>
  </div>;
}

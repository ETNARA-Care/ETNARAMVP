import { useNavigate } from "react-router-dom";
import type { OperationalAlert } from "@/api/operations";
import { AdminPanel, AdminPanelHeader, SeverityBadge } from "@/components/admin/AdminUI";
import { severityStyle } from "@/components/admin/severity";
import { plural, relativeFmt } from "./overviewModel";

export function IncidentsPanel({ alerts, className = "" }: { alerts: OperationalAlert[]; className?: string }) {
 const navigate = useNavigate();
 const open = alerts.filter((a) => a.category === "open_incident");
 return (
 <AdminPanel className={`flex flex-col ${className}`}>
 <AdminPanelHeader title="Incidentes" description={open.length ? plural(open.length, "incidente abierto", "incidentes abiertos") : "Sin incidentes abiertos"} />
 {open.length ? (
 <ol className="relative mx-5 mt-5 space-y-5 border-l border-[var(--color-border)] pl-5 sm:mx-6">
 {open.slice(0, 4).map((a) => (
 <li key={a.key} className="relative">
 <span className={`absolute -left-[26px] top-1.5 h-[11px] w-[11px] rounded-full ring-4 ring-[var(--color-surface)] ${severityStyle[a.severity].dot}`} aria-hidden />
 <button type="button" onClick={() => navigate(a.actionPath)} className="w-full text-left">
 <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><span className="text-sm font-medium text-[var(--color-text-primary)]">{a.title}</span><SeverityBadge severity={a.severity} /></span>
 <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">{a.detail}. {relativeFmt(a.occurredAt)}</span>
 </button>
 </li>
 ))}
 </ol>
 ) : <p className="px-5 pt-4 text-sm text-[var(--color-text-secondary)] sm:px-6">Los incidentes abiertos aparecerán aquí con su prioridad.</p>}
 <div className="mt-auto p-5 sm:px-6"><button type="button" onClick={() => navigate("/agency/incidents")} className="min-h-11 w-full rounded-[10px] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-text-primary)]/25">Ver incidentes</button></div>
 </AdminPanel>
 );
}

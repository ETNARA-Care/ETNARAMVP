import { useNavigate } from "react-router-dom";
import type { OperationalAlert } from "@/api/operations";
import type { WorkerMembership } from "@/api/shifts";
import type { AdminShift } from "@/features/agency/useAgencySupervision";
import { AdminPanel, AdminPanelHeader, SeverityBadge } from "@/components/admin/AdminUI";

/** ETNARA Workforce: personal activo, quién trabaja ahora y alertas reales de credenciales y llegadas. */
export function WorkforcePanel({ workers, todayShifts, alerts, className = "" }: {
 workers: WorkerMembership[]; todayShifts: AdminShift[]; alerts: OperationalAlert[]; className?: string;
}) {
 const navigate = useNavigate();
 const active = workers.filter((w) => w.status === "active").length;
 const onShift = new Set(todayShifts.filter((s) => s.status === "in_progress" && s.caregiver).map((s) => s.caregiver!.id)).size;
 const issues = alerts.filter((a) => a.category === "expiring_credential" || a.category === "missed_check_in");
 return (
 <AdminPanel className={`flex flex-col ${className}`}>
 <AdminPanelHeader title="Personal" description="ETNARA Workforce" />
 <div className="grid grid-cols-2 gap-4 px-5 pt-5 sm:px-6">
 <div><p className="font-display text-4xl leading-none tabular-nums text-[var(--color-text-primary)]">{active}</p><p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">activos en la organización</p></div>
 <div className="border-l border-[var(--color-border)] pl-4"><p className="font-display text-4xl leading-none tabular-nums text-[var(--color-text-primary)]">{onShift}</p><p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">trabajando ahora</p></div>
 </div>
 <p className="mt-5 border-t border-[var(--color-border)] px-5 pb-1 pt-4 text-xs text-[var(--color-text-muted)] sm:px-6">Credenciales y llegadas que necesitan revisión</p>
 {issues.length ? (
 <ul className="divide-y divide-[var(--color-border)]">
 {issues.slice(0, 4).map((a) => (
 <li key={a.key}>
 <button type="button" onClick={() => navigate(a.actionPath)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-[var(--color-ivory-100)] sm:px-6">
 <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-[var(--color-text-primary)]">{a.title}</span><span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">{a.detail}</span></span>
 <SeverityBadge severity={a.severity} />
 </button>
 </li>
 ))}
 </ul>
 ) : <p className="px-5 py-3 text-sm text-[var(--color-text-secondary)] sm:px-6">No hay credenciales ni llegadas pendientes.</p>}
 <div className="mt-auto p-5 sm:px-6"><button type="button" onClick={() => navigate("/agency/workers")} className="min-h-11 w-full rounded-[10px] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-text-primary)]/25">Ver todo el personal</button></div>
 </AdminPanel>
 );
}

import { CheckCircle2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { OperationsCenter } from "@/api/operations";
import { ErrorState, Skeleton } from "@/components/ui";
import { AdminPanel, AdminPanelHeader } from "@/components/admin/AdminUI";
import { severityStyle } from "@/components/admin/severity";
import { categoryAction, categoryPillar, relativeFmt, sortAlerts } from "./overviewModel";

export function AttentionQueue({ center, loading, error, onRetry, className = "" }: {
 center: OperationsCenter | null; loading: boolean; error: boolean; onRetry: () => void; className?: string;
}) {
 const navigate = useNavigate();
 const alerts = center ? sortAlerts(center.alerts) : [];
 return (
 <AdminPanel className={className}>
 <AdminPanelHeader title="Requiere atención" description="Desde el Centro operacional, ordenado por urgencia."
 action={<button type="button" onClick={() => navigate("/agency/operations")} className="text-sm font-medium text-[var(--color-navy-900)] hover:underline">Ver centro operacional</button>} />
 <div className="mt-3 border-t border-[var(--color-border)]">
 {loading && !center && <div className="space-y-3 p-5 sm:p-6"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
 {error && <div className="p-5 sm:p-6"><ErrorState kind="server" onRetry={onRetry} /></div>}
 {center && alerts.length === 0 && (
 <div className="flex items-center gap-3 px-5 py-8 sm:px-6">
 <CheckCircle2 className="shrink-0 text-[var(--color-success-700)]" aria-hidden />
 <div><p className="font-medium text-[var(--color-text-primary)]">No hay asuntos pendientes</p><p className="text-sm text-[var(--color-text-secondary)]">Las alertas de cobertura, llegadas, credenciales, incidentes y horas aparecerán aquí.</p></div>
 </div>
 )}
 <ul className="divide-y divide-[var(--color-border)]">
 {alerts.slice(0, 6).map((a) => {
 const s = severityStyle[a.severity];
 return (
 <li key={a.key} className="relative">
 <span className={`absolute bottom-4 left-0 top-4 w-[3px] rounded-r-full ${s.dot}`} aria-hidden />
 <div className="flex flex-col gap-2 py-3 pl-4 pr-4 sm:gap-3 sm:py-4 sm:pl-5 sm:pr-5 sm:flex-row sm:items-center sm:gap-5 sm:pl-6 sm:pr-6">
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
 <span className={`font-medium ${s.text}`}>{s.label}</span>
 <span className="text-[var(--color-text-muted)]">ETNARA {categoryPillar[a.category]}</span>
 <span className="text-[var(--color-text-muted)]">{relativeFmt(a.occurredAt)}</span>
 {a.escalatedAt && <span className="text-[var(--color-text-muted)]">Escalado</span>}
 </div>
 <p className="mt-1 font-medium text-[var(--color-text-primary)]">{a.title}</p>
 <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-secondary)] sm:text-sm">{a.detail}</p>
 </div>
 <button type="button" onClick={() => navigate(a.actionPath)}
 className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1 self-start rounded-[10px] px-3.5 text-sm font-medium transition-colors sm:self-center ${a.severity === "critical" ? "bg-[var(--color-navy-900)] text-white hover:bg-[var(--color-navy-800)]" : "border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]/25"}`}>
 {categoryAction[a.category]}<ChevronRight size={16} className="-mr-1 opacity-70" aria-hidden />
 </button>
 </div>
 </li>
 );
 })}
 </ul>
 {alerts.length > 6 && (
 <button type="button" onClick={() => navigate("/agency/operations")} className="w-full border-t border-[var(--color-border)] px-6 py-3.5 text-left text-sm font-medium text-[var(--color-navy-900)] hover:bg-[var(--color-ivory-100)]">
 Ver las {alerts.length} alertas
 </button>
 )}
 </div>
 </AdminPanel>
 );
}

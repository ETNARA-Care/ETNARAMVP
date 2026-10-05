import { Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ResidentCompliance } from "@/features/agency/useResidentCompliance";
import type { Establishment } from "@/api/establishments";
import { Skeleton } from "@/components/ui";
import { AdminPanel, AdminPanelHeader, ReadinessRing } from "@/components/admin/AdminUI";

/** ETNARA Compliance: preparación real de expedientes de residentes + alertas de credenciales. */
export function ReadinessPanel({ rows, places, error, credentialAlerts, className = "" }: {
 rows: ResidentCompliance[] | null; places: Establishment[]; error: boolean; credentialAlerts: number; className?: string;
}) {
 const navigate = useNavigate();
 const total = rows?.length ?? 0;
 const complete = (rows ?? []).filter((r) => r.missing.length === 0 && r.expired.length === 0).length;
 const expired = (rows ?? []).reduce((n, r) => n + r.expired.length, 0);
 const expiring = (rows ?? []).reduce((n, r) => n + r.expiring.length, 0);
 const missing = (rows ?? []).reduce((n, r) => n + r.missing.length, 0);
 const score = total ? Math.round((complete / total) * 100) : null;
 const lines = [
 { label: "Documentos faltantes", value: missing, warn: missing > 0 },
 { label: "Documentos vencidos", value: expired, warn: expired > 0 },
 { label: "Vencen en 30 días", value: expiring, warn: expiring > 0 },
 { label: "Credenciales del personal con alerta", value: credentialAlerts, warn: credentialAlerts > 0 },
 ];
 return (
 <AdminPanel tone="navy" className={className}>
 <AdminPanelHeader inverted title="ETNARA Compliance" description="Preparación de expedientes de residentes" />
 <div className="grid grid-cols-[auto_1fr] items-center gap-4 px-4 pb-4 pt-3 sm:flex sm:flex-col sm:gap-5 sm:px-6 sm:pb-6 sm:pt-5">
 {rows === null && !error ? <Skeleton className="h-40 w-40 rounded-full opacity-20" /> : (
 <ReadinessRing value={score} caption={total ? `${complete} de ${total} expedientes completos` : "Sin residentes activos"} size={118} />
 )}
 {error && <p className="text-center text-sm text-white/75">No se pudieron leer los expedientes. Ábrelos desde Compliance.</p>}
 <span className="col-start-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] text-white/85 sm:text-xs">
 <Building2 size={14} aria-hidden />{places.length === 1 ? "1 establecimiento activo" : `${places.length} establecimientos activos`}
 </span>
 <ul className="col-span-2 w-full divide-y divide-white/10 border-t border-white/10">
 {lines.map((l) => (
 <li key={l.label} className="flex items-baseline justify-between gap-3 py-2 text-xs sm:py-2.5 sm:text-sm">
 <span className="min-w-0 text-white/85">{l.label}</span>
 <span className={`shrink-0 font-display text-xl tabular-nums ${l.warn ? "text-[#E6B877]" : "text-[var(--color-sage-300)]"}`}>{l.value}</span>
 </li>
 ))}
 </ul>
 <button type="button" onClick={() => navigate("/agency/compliance")} className="col-span-2 min-h-10 w-full rounded-[10px] sm:min-h-11 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15">Abrir Compliance</button>
 </div>
 </AdminPanel>
 );
}

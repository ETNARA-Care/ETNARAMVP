import { Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ResidentCompliance } from "@/features/agency/useResidentCompliance";
import type { Establishment } from "@/api/establishments";
import { Skeleton } from "@/components/ui";
import { AdminPanel, AdminPanelHeader, ReadinessRing } from "@/components/admin/AdminUI";

/**
 * Cumplimiento: expedientes de residentes (solo hogares residenciales) + alertas de credenciales.
 * Según la lista de la organización; ETNARA no certifica el cumplimiento legal.
 */
export function ReadinessPanel({ rows, places, error, credentialAlerts, residential = true, className = "" }: {
 rows: ResidentCompliance[] | null; places: Establishment[]; error: boolean; credentialAlerts: number; residential?: boolean; className?: string;
}) {
 const navigate = useNavigate();
 const total = rows?.length ?? 0;
 const complete = (rows ?? []).filter((r) => r.missing.length === 0 && r.expired.length === 0).length;
 const expired = (rows ?? []).reduce((n, r) => n + r.expired.length, 0);
 const expiring = (rows ?? []).reduce((n, r) => n + r.expiring.length, 0);
 const missing = (rows ?? []).reduce((n, r) => n + r.missing.length, 0);
 const score = total ? Math.round((complete / total) * 100) : null;
 if (!residential) {
  // Agencia de cuido domiciliario sin establecimientos: solo las credenciales del personal.
  return (
   <AdminPanel tone="navy" className={className}>
    <AdminPanelHeader inverted title="Cumplimiento" description="Credenciales del personal según las políticas de tu agencia" />
    <div className="flex flex-col gap-4 px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-5">
     <div className="flex items-baseline justify-between gap-3 border-y border-white/10 py-3 text-sm">
      <span className="min-w-0 text-white/85">Credenciales del personal con alerta</span>
      <span className={`shrink-0 font-display text-2xl tabular-nums ${credentialAlerts > 0 ? "text-[#E6B877]" : "text-[var(--color-sage-300)]"}`}>{credentialAlerts}</span>
     </div>
     <p className="text-xs text-white/70">ETNARA te avisa según tus políticas; no certifica el cumplimiento legal.</p>
     <button type="button" onClick={() => navigate("/agency/compliance")} className="min-h-11 w-full rounded-[10px] bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15">Abrir Cumplimiento</button>
    </div>
   </AdminPanel>
  );
 }
 const lines = [
 { label: "Documentos faltantes", value: missing, warn: missing > 0 },
 { label: "Documentos vencidos", value: expired, warn: expired > 0 },
 { label: "Vencen en 30 días", value: expiring, warn: expiring > 0 },
 { label: "Credenciales del personal con alerta", value: credentialAlerts, warn: credentialAlerts > 0 },
 ];
 return (
 <AdminPanel tone="navy" className={className}>
 <AdminPanelHeader inverted title="Cumplimiento" description="Expedientes de residentes según la lista del hogar" />
 <div className="grid grid-cols-[auto_1fr] items-center gap-4 px-4 pb-4 pt-3 sm:flex sm:flex-col sm:gap-5 sm:px-6 sm:pb-6 sm:pt-5">
 {rows === null && !error ? <Skeleton className="h-40 w-40 rounded-full opacity-20" /> : (
 <ReadinessRing value={score} caption={total ? `${complete} de ${total} expedientes completos` : places.length === 0 ? "Sin establecimientos" : "Sin residentes en establecimientos"} size={118} />
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
 <button type="button" onClick={() => navigate("/agency/compliance")} className="col-span-2 min-h-10 w-full rounded-[10px] sm:min-h-11 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15">Abrir Cumplimiento</button>
 </div>
 </AdminPanel>
 );
}

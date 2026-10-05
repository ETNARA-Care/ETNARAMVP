import { useNavigate } from "react-router-dom";
import type { Establishment } from "@/api/establishments";
import type { ResidentCompliance } from "@/features/agency/useResidentCompliance";
import { AdminPanel, AdminPanelHeader, Meter } from "@/components/admin/AdminUI";

/** ETNARA Care: personas atendidas y estado de sus expedientes por establecimiento. */
export function ResidentsPanel({ recipients, rows, places, className = "" }: { recipients: number; rows: ResidentCompliance[] | null; places: Establishment[]; className?: string }) {
 const navigate = useNavigate();
 const complete = (r: ResidentCompliance) => r.missing.length === 0 && r.expired.length === 0;
 const byPlace = places.map((p) => {
 const list = (rows ?? []).filter((r) => r.establishmentId === p.id);
 return { id: p.id, name: p.name, total: list.length, complete: list.filter(complete).length };
 }).filter((p) => p.total > 0);
 const attention = (rows ?? []).filter((r) => !complete(r)).length;
 return (
 <AdminPanel className={`flex flex-col ${className}`}>
 <AdminPanelHeader title="Residentes" description="ETNARA Care" />
 <div className="px-5 pt-5 sm:px-6">
 <div className="grid grid-cols-2 gap-4">
 <div><p className="font-display text-4xl leading-none tabular-nums text-[var(--color-text-primary)]">{recipients}</p><p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">personas atendidas</p></div>
 <div className="border-l border-[var(--color-border)] pl-4"><p className={`font-display text-4xl leading-none tabular-nums ${attention ? "text-[var(--color-warning-700)]" : "text-[var(--color-text-primary)]"}`}>{rows === null ? "—" : attention}</p><p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">expedientes por completar</p></div>
 </div>
 {byPlace.length > 0 && (
 <ul className="mt-6 space-y-4">
 {byPlace.map((p) => (
 <li key={p.id}>
 <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate text-[var(--color-text-primary)]">{p.name}</span><span className="shrink-0 tabular-nums text-[var(--color-text-muted)]">{p.complete}/{p.total} completos</span></div>
 <div className="mt-1.5"><Meter value={p.complete} max={p.total} label={`Expedientes completos en ${p.name}`} /></div>
 </li>
 ))}
 </ul>
 )}
 </div>
 <div className="mt-auto p-5 sm:px-6"><button type="button" onClick={() => navigate("/agency/residents")} className="min-h-11 w-full rounded-[10px] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-text-primary)]/25">Ver residentes</button></div>
 </AdminPanel>
 );
}

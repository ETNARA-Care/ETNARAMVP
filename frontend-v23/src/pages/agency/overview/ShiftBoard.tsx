import { useState } from "react";
import { CalendarPlus, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { recipientName } from "@/api/shifts";
import type { AdminShift } from "@/features/agency/useAgencySupervision";
import { Avatar, EmptyState } from "@/components/ui";
import { AdminPanel, AdminPanelHeader } from "@/components/admin/AdminUI";
import { timeFmt } from "./overviewModel";

const MAX_ROWS = 8;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const hourOf = (v: string, base: number) => (new Date(v).getTime() - base) / 3_600_000;
const caregiverLabel = (s: AdminShift) => s.caregiver?.display_name ?? s.caregiver?.internal_role ?? null;

function Timeline({ shifts }: { shifts: AdminShift[] }) {
 const navigate = useNavigate();
 const base = startOfToday();
 const starts = shifts.map((s) => hourOf(s.scheduled_start, base));
 const ends = shifts.map((s) => hourOf(s.scheduled_end, base));
 let from = Math.floor(Math.min(...starts)), to = Math.ceil(Math.max(...ends));
 if (to - from < 8) to = from + 8;
 const span = to - from, pct = (h: number) => ((h - from) / span) * 100;
 const step = span > 16 ? 4 : 2;
 const ticks: number[] = []; for (let t = from; t <= to; t += step) ticks.push(t);
 const [renderedAt] = useState(() => Date.now());
 const now = (renderedAt - base) / 3_600_000;
 const rows = [...new Set(shifts.map((s) => s.care_recipient_id ?? s.id))].slice(0, MAX_ROWS);
 const tickLabel = (h: number) => timeFmt(new Date(base + h * 3_600_000));

 return (
 <div className="hidden px-6 pb-6 pt-4 md:block">
 <div className="grid grid-cols-[minmax(120px,170px)_1fr] gap-x-4">
 <div />
 <div className="relative h-6 text-[0.6875rem] text-[var(--color-text-muted)]">
 {ticks.map((t, i) => <span key={t} className={`absolute whitespace-nowrap ${i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${pct(t)}%` }}>{tickLabel(t)}</span>)}
 </div>
 {rows.map((rowId) => {
 const rowShifts = shifts.filter((s) => (s.care_recipient_id ?? s.id) === rowId);
 return (
 <div key={rowId} className="contents">
 <div className="flex min-w-0 items-center border-t border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]"><span className="truncate">{rowShifts[0].recipient ? recipientName(rowShifts[0].recipient) : "Sin persona asignada"}</span></div>
 <div className="relative h-[60px] border-t border-[var(--color-border)]">
 {ticks.slice(1, -1).map((t) => <span key={t} className="absolute inset-y-0 w-px bg-[var(--color-border)]/70" style={{ left: `${pct(t)}%` }} aria-hidden />)}
 {rowShifts.map((s) => {
 const a = hourOf(s.scheduled_start, base), b = hourOf(s.scheduled_end, base), who = caregiverLabel(s);
 return (
 <button key={s.id} type="button" onClick={() => navigate(`/agency/shifts/${s.id}`)} title={`${timeFmt(s.scheduled_start)} – ${timeFmt(s.scheduled_end)}`}
 className={`absolute inset-y-1.5 flex min-w-0 items-center gap-2 overflow-hidden rounded-[10px] px-2 text-left ${who ? "border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-primary)]/25" : "border border-dashed border-[var(--color-danger-700)]/60 bg-[var(--color-danger-100)] text-[var(--color-danger-700)]"}`}
 style={{ left: `calc(${pct(a)}% + 2px)`, width: `calc(${((b - a) / span) * 100}% - 4px)` }}>
 {who ? <Avatar name={who} size={26} /> : <UserPlus size={16} className="shrink-0" aria-hidden />}
 <span className="min-w-0">
 <span className={`block truncate text-sm font-medium ${who ? "text-[var(--color-text-primary)]" : ""}`}>{who ?? "Sin cubrir"}</span>
 <span className={`block truncate text-[0.6875rem] ${who ? "text-[var(--color-text-muted)]" : "opacity-80"}`}>{s.status === "in_progress" ? "En curso" : `${timeFmt(s.scheduled_start)} – ${timeFmt(s.scheduled_end)}`}</span>
 </span>
 </button>
 );
 })}
 </div>
 </div>
 );
 })}
 {now >= from && now <= to && (<>
 <div />
 <div className="relative h-0">
 <span className="absolute bottom-0 w-px bg-[var(--color-navy-900)]" style={{ left: `${pct(now)}%`, height: `${rows.length * 60 + 4}px` }} aria-hidden />
 <span className="absolute -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-full bg-[var(--color-navy-900)] px-2 py-0.5 text-[0.6875rem] text-white" style={{ left: `${pct(now)}%` }}>Ahora {timeFmt(new Date(renderedAt))}</span>
 </div>
 </>)}
 </div>
 </div>
 );
}

function CompactList({ shifts }: { shifts: AdminShift[] }) {
 const navigate = useNavigate();
 const period = (s: AdminShift) => { const h = new Date(s.scheduled_start).getHours(); return h < 12 ? "Mañana" : h < 18 ? "Tarde" : "Noche"; };
 const groups = ["Mañana", "Tarde", "Noche"].map((label) => ({ label, items: shifts.filter((s) => period(s) === label) })).filter((g) => g.items.length);
 return (
 <div className="px-4 pb-3 pt-2 md:hidden">
 {groups.map((g) => (
 <div key={g.label} className="mt-1.5">
 <p className="px-1 pb-1.5 text-xs text-[var(--color-text-muted)]">{g.label}</p>
 <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[12px] border border-[var(--color-border)]">
 {g.items.map((s) => {
 const who = caregiverLabel(s);
 return (
 <li key={s.id}>
 <button type="button" onClick={() => navigate(`/agency/shifts/${s.id}`)} className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left ${who ? "" : "bg-[var(--color-danger-100)]/60"}`}>
 {who ? <Avatar name={who} size={28} /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-danger-100)] text-[var(--color-danger-700)]"><UserPlus size={15} aria-hidden /></span>}
 <span className="min-w-0 flex-1">
 <span className={`block truncate text-sm font-medium ${who ? "text-[var(--color-text-primary)]" : "text-[var(--color-danger-700)]"}`}>{who ?? "Sin cubrir"}</span>
 <span className="block truncate text-xs text-[var(--color-text-muted)]">{s.recipient ? recipientName(s.recipient) : "Sin persona asignada"}, {timeFmt(s.scheduled_start)} – {timeFmt(s.scheduled_end)}</span>
 </span>
 {!who && <span className="shrink-0 rounded-[10px] bg-[var(--color-navy-900)] px-3 py-1.5 text-xs font-medium text-white">Asignar</span>}
 </button>
 </li>
 );
 })}
 </ul>
 </div>
 ))}
 </div>
 );
}

export function ShiftBoard({ shifts, onCreate, className = "" }: { shifts: AdminShift[]; onCreate: () => void; className?: string }) {
 const active = shifts.filter((s) => s.status !== "cancelled");
 const open = active.filter((s) => !s.caregiver).length;
 const rowCount = new Set(active.map((s) => s.care_recipient_id ?? s.id)).size;
 return (
 <AdminPanel className={className}>
 <AdminPanelHeader title="Turnos de hoy"
 description={active.length ? `${active.length - open} de ${active.length} cubiertos.${open ? ` ${open} necesitan cuidador.` : ""}` : "No hay turnos programados para hoy."}
 action={<button type="button" onClick={onCreate} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium hover:border-[var(--color-text-primary)]/25"><CalendarPlus size={15} aria-hidden />Crear turno</button>} />
 {active.length ? (<>
 <Timeline shifts={active} />
 <CompactList shifts={active} />
 {rowCount > MAX_ROWS && <p className="hidden px-6 pb-5 text-sm text-[var(--color-text-secondary)] md:block">Se muestran {MAX_ROWS} de {rowCount} personas. El resto está en Turnos.</p>}
 </>) : <div className="p-5 sm:p-6"><EmptyState title="Sin turnos hoy" description="Cuando programes turnos, verás aquí la cobertura del día." /></div>}
 </AdminPanel>
 );
}

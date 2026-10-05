import type { OperationsCenter } from "@/api/operations";
import type { AdminShift } from "@/features/agency/useAgencySupervision";
import { Skeleton } from "@/components/ui";
import { plural } from "./overviewModel";

/** Saludo editorial: la situación del día en una frase + cifras ejecutivas reales. */
export function Briefing({ organizationName, center, centerLoading, centerError, todayShifts, recipients, careEventsToday }: {
 organizationName: string; center: OperationsCenter | null; centerLoading: boolean; centerError: boolean;
 todayShifts: AdminShift[]; recipients: number; careEventsToday: number;
}) {
 const raw = new Intl.DateTimeFormat("es-PR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
 const dateLabel = raw.charAt(0).toUpperCase() + raw.slice(1);
 const active = todayShifts.filter((s) => s.status !== "cancelled");
 const covered = active.filter((s) => Boolean(s.caregiver)).length;
 const uncovered = active.length - covered;
 const inProgress = active.filter((s) => s.status === "in_progress").length;
 const urgent = center?.summary.critical ?? 0;
 const toPlan = (center?.summary.warning ?? 0) + (center?.summary.info ?? 0);

 let headline: string;
 if (center) {
 headline = urgent === 0 && toPlan === 0
 ? "Hoy no hay asuntos urgentes ni pendientes por planificar."
 : `Hoy hay ${plural(urgent, "asunto urgente", "asuntos urgentes")} y ${toPlan} por planificar.`;
 } else {
 headline = uncovered > 0 ? `Hoy hay ${plural(uncovered, "turno sin cubrir", "turnos sin cubrir")}.` : "La cobertura de hoy está completa.";
 }

 const stats = [
 { label: "Personas atendidas", value: String(recipients), sub: "activas en la organización" },
 { label: "Turnos cubiertos hoy", value: `${covered}/${active.length}`, sub: uncovered ? `${uncovered} sin cubrir` : "Cobertura completa", alert: uncovered > 0 },
 { label: "En curso ahora", value: String(inProgress), sub: "turnos activos" },
 { label: "Registros de cuidado", value: String(careEventsToday), sub: "documentados hoy" },
 ];

 return (
 <div className="admin-enter min-w-0">
 <p className="text-sm text-[var(--color-text-muted)]">{dateLabel} en {organizationName}</p>
 {centerLoading && !center
 ? <Skeleton className="mt-3 h-20 max-w-[36rem]" />
 : <h1 className="mt-1.5 max-w-[28ch] font-display text-[1.65rem] font-normal leading-[1.08] tracking-[-0.02em] text-[var(--color-text-primary)] sm:mt-2 sm:text-[2.6rem]">{headline}</h1>}
 {centerError && <p className="mt-2 text-sm text-[var(--color-warning-700)]">El Centro operacional no respondió; el resumen usa solo la cobertura de turnos.</p>}
 <dl className="mt-4 grid grid-cols-2 gap-2 sm:mt-7 sm:gap-y-5 sm:border-y sm:border-[var(--color-border)] sm:py-5 md:grid-cols-4 md:divide-x md:divide-[var(--color-border)]">
 {stats.map((s, i) => (
 <div key={s.label} className={`min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)] sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none ${i % 2 === 1 ? "md:pl-6" : "md:px-6 md:first:pl-0"}`}>
 <dt className="text-xs leading-tight text-[var(--color-text-secondary)] sm:text-sm">{s.label}</dt>
 <dd className="mt-1 font-display text-2xl leading-none tabular-nums text-[var(--color-text-primary)] sm:text-3xl">{s.value}</dd>
 <dd className={`mt-1 text-[11px] leading-tight sm:mt-1.5 sm:text-xs ${s.alert ? "font-medium text-[var(--color-danger-700)]" : "text-[var(--color-text-muted)]"}`}>{s.sub}</dd>
 </div>
 ))}
 </dl>
 </div>
 );
}

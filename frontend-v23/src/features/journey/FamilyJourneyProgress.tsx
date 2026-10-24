import { Check, Clock } from "lucide-react";
import type { Journey } from "@/api/journey";
import { delaySentence, time } from "./journeyText";

/**
 * Family view of today's visit (Gate 7): assigned → on the way → arrived →
 * service started → finished, with the declared times only. Never a location,
 * never an estimated arrival time, never whether an arrival is under review.
 */
export function FamilyJourneyProgress({ journey }: { journey: Journey }) {
  if (journey.state === "CANCELLED") {
    return <p className="mt-4 rounded-2xl bg-white/8 p-3 text-sm text-white/85" data-testid="family-journey">Este turno fue cancelado por la agencia.</p>;
  }
  if (journey.state === "UNASSIGNED" || journey.state === "PENDING_ACCEPTANCE") return null;
  const steps: { label: string; at: string | null; done: boolean }[] = [
    { label: "Cuidadora asignada", at: null, done: true },
    { label: "En camino", at: journey.enRouteAt, done: Boolean(journey.enRouteAt) },
    { label: "Llegada registrada", at: journey.arrivedAt, done: Boolean(journey.arrivedAt) },
    { label: "Servicio iniciado", at: journey.startedAt, done: Boolean(journey.startedAt) },
    { label: "Servicio finalizado", at: journey.finishedAt, done: Boolean(journey.finishedAt) },
  ];
  const current = journey.state === "EN_ROUTE" ? 1 : -1;
  return (
    <div className="mt-4" data-testid="family-journey">
      <ol className="space-y-2.5" aria-label="Progreso de la visita">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${s.done ? "bg-[#b8c9ad] text-[#102b57]" : "border border-white/30 text-white/40"} ${i === current ? "ring-2 ring-[#b8c9ad]/60 ring-offset-2 ring-offset-[#102b57]" : ""}`}>
              {s.done ? <Check size={14} aria-hidden /> : null}
            </span>
            <span className={s.done ? "text-white" : "text-white/55"}>{s.label}</span>
            {s.at && <span className="ml-auto text-xs text-white/70">{time(s.at)}</span>}
          </li>
        ))}
      </ol>
      {journey.delay && !journey.arrivedAt && !journey.startedAt && (
        <div className="mt-3 rounded-2xl bg-[#f6c66d]/15 p-3 text-sm text-white" role="status" data-testid="family-delay">
          <p className="flex items-start gap-2"><Clock size={16} className="mt-0.5 shrink-0 text-[#f6c66d]" aria-hidden />{delaySentence(journey.delay)}</p>
          <p className="mt-1 pl-6 text-xs text-white/70">Informado a las {time(journey.delay.reportedAt)} · No es una hora estimada de llegada.</p>
        </div>
      )}
    </div>
  );
}

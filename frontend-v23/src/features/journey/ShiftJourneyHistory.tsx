import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { getShiftJourney, type DelayReason, type Journey, type JourneyHistoryItem } from "@/api/journey";
import { getToken } from "@/auth/token";
import { Badge, Card } from "@/components/ui";
import { DELAY_REASON_TEXT, STATE_TEXT, time } from "./journeyText";

const KIND_TEXT: Record<string, string> = {
  ASSIGNED: "Asignada", ACCEPTED: "Aceptó el turno", DECLINED: "Rechazó el turno", EN_ROUTE: "Voy en camino",
  DELAY_REPORTED: "Informó un retraso", ARRIVED: "Llegó", STARTED: "Comenzó el turno", FINISHED: "Finalizó el turno", CANCELLED: "Turno cancelado",
};
const day = (v: string) => new Date(v).toLocaleDateString("es-PR", { day: "numeric", month: "short", timeZone: "America/Puerto_Rico" });

function detailText(item: JourneyHistoryItem): string | null {
  const d = item.detail ?? {};
  if (item.kind === "DELAY_REPORTED") return `Unos ${d.minutes} min · ${DELAY_REASON_TEXT[d.reason as DelayReason] ?? ""}`;
  if (item.kind === "ARRIVED") return d.needsReview ? (d.reviewed ? "Revisada por la agencia" : "Pendiente de revisión") : "Cerca del lugar";
  if (["ASSIGNED", "ACCEPTED", "DECLINED"].includes(item.kind) && d.caregiver) return String(d.caregiver);
  return null;
}

/** «Historial operativo» of one visit (Gate 7, agency only): every step with its time. */
export function ShiftJourneyHistory({ organizationId, shiftId }: { organizationId: string; shiftId: string }) {
  const [data, setData] = useState<{ journey: Journey; history?: JourneyHistoryItem[] } | null>(null);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getShiftJourney(organizationId, shiftId, token).then(setData).catch(() => setData(null));
  }, [organizationId, shiftId]);
  if (!data?.history) return null;
  return (
    <Card aria-label="Historial operativo" data-testid="journey-history">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[var(--text-h3)]"><History size={18} aria-hidden /> Historial operativo</h2>
        <Badge tone={data.journey.state === "CANCELLED" ? "danger" : data.journey.state === "EN_ROUTE" ? "warning" : "neutral"}>{STATE_TEXT[data.journey.state]}</Badge>
      </div>
      {data.history.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Aún no hay movimientos.</p> : (
        <ol className="space-y-2">
          {data.history.map((h, i) => (
            <li key={`${h.kind}-${h.at}-${i}`} className="flex gap-3 text-[var(--text-small)]">
              <span className="w-24 shrink-0 text-[var(--color-text-muted)]">{day(h.at)} · {time(h.at)}</span>
              <span className="min-w-0"><span className="font-medium text-[var(--color-text-primary)]">{KIND_TEXT[h.kind] ?? h.kind}</span>
                {detailText(h) && <span className="text-[var(--color-text-secondary)]"> · {detailText(h)}</span>}</span>
            </li>
          ))}
        </ol>)}
      <p className="mt-3 text-[var(--text-caption)] text-[var(--color-text-muted)]">Solo lo que declara la cuidadora y los registros del turno. No se guarda ningún recorrido.</p>
    </Card>
  );
}

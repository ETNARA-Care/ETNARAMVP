import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "lucide-react";
import { listTodayJourneys, type TodayJourney } from "@/api/journey";
import { getToken } from "@/auth/token";
import { Badge, Card } from "@/components/ui";
import { DELAY_REASON_TEXT, RISK_TEXT, STATE_TEXT, time } from "./journeyText";

const ORDER: Record<string, number> = { EN_ROUTE: 0, ASSIGNED: 1, PENDING_ACCEPTANCE: 2, ARRIVED: 3, IN_SERVICE: 4, UNASSIGNED: 5, COMPLETED: 6, CANCELLED: 7 };

/**
 * «Hoy en ruta» (Gate 7): who is on the way, who reported a delay, who has not
 * declared a departure yet (preventive, not a breach) and who is late.
 */
export function TodayJourneysPanel({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<TodayJourney[] | null>(null);
  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try { setItems(await listTodayJourneys(organizationId, token)); } catch { setItems([]); }
  }, [organizationId]);
  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 60_000); return () => window.clearInterval(t); }, [load]);
  if (items === null) return null;
  const sorted = [...items].sort((a, b) => (b.risks.length - a.risks.length) || (ORDER[a.journey.state] - ORDER[b.journey.state]) || a.scheduledStart.localeCompare(b.scheduledStart));
  const onTheWay = items.filter((i) => i.journey.state === "EN_ROUTE").length;
  const atRisk = items.filter((i) => i.risks.length).length;
  return (
    <Card aria-label="Hoy en ruta" data-testid="today-journeys">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg"><Navigation size={18} aria-hidden /> Hoy en ruta</h2>
        <div className="flex gap-2"><Badge tone="neutral">{onTheWay} en camino</Badge>{atRisk > 0 && <Badge tone="warning">{atRisk} en riesgo</Badge>}</div>
      </div>
      {sorted.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">No hay visitas hoy.</p> : (
        <ul className="divide-y divide-[var(--color-border)]">
          {sorted.map((i) => (
            <li key={i.shiftId}>
              <button type="button" onClick={() => navigate(`/agency/shifts/${i.shiftId}`)} className="flex w-full flex-col gap-1 py-3 text-left">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--color-text-primary)]">{time(i.scheduledStart)} · {i.recipient ?? "Persona atendida"}</span>
                  <Badge tone={i.journey.state === "EN_ROUTE" ? "success" : i.journey.state === "CANCELLED" ? "danger" : "neutral"}>{STATE_TEXT[i.journey.state]}</Badge>
                  {i.risks.map((r) => <Badge key={r} tone="warning">{RISK_TEXT[r]}</Badge>)}
                </span>
                <span className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
                  {i.caregiver ?? "Sin cuidadora"}
                  {i.journey.enRouteAt && ` · en camino desde las ${time(i.journey.enRouteAt)}`}
                  {i.journey.delay && ` · retraso informado: unos ${i.journey.delay.minutes} min (${DELAY_REASON_TEXT[i.journey.delay.reason].toLowerCase()})`}
                  {i.journey.arrivedAt && ` · llegó ${time(i.journey.arrivedAt)}${i.journey.arrivalNeedsReview ? " (revisar)" : ""}`}
                </span>
              </button>
            </li>
          ))}
        </ul>)}
      <p className="mt-2 text-[var(--text-caption)] text-[var(--color-text-muted)]">«Aún no registra salida» es preventivo: la cuidadora puede ir en camino sin haberlo marcado.</p>
    </Card>
  );
}

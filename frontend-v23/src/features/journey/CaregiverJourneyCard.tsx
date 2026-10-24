import { useCallback, useEffect, useState } from "react";
import { Clock, Navigation } from "lucide-react";
import type { ApiError } from "@/api/client";
import { DELAY_MINUTES, declareEnRoute, getShiftJourney, reportDelay, type DelayMinutes, type DelayReason, type Journey } from "@/api/journey";
import { getToken } from "@/auth/token";
import { Badge, Button, Card, Modal, useToast } from "@/components/ui";
import { DELAY_REASON_TEXT, JOURNEY_ERROR_TEXT, time } from "./journeyText";

const WINDOW_BEFORE_MS = 2 * 3600_000;
const WINDOW_AFTER_MS = 3600_000;

/**
 * «Voy en camino» (Gate 7). The caregiver declares the departure and, if
 * needed, a delay from fixed options. Nothing is read from the phone's GPS
 * and nothing is tracked: the family and the agency only see what is declared.
 * «En camino» ends by itself with «Llegué», «Comenzar turno» or a cancellation.
 */
export function CaregiverJourneyCard({ organizationId, shiftId, scheduledStart, onChanged }: {
  organizationId: string; shiftId: string; scheduledStart: string; onChanged?: () => void;
}) {
  const { show } = useToast();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [busy, setBusy] = useState(false);
  const [delayOpen, setDelayOpen] = useState(false);
  const [minutes, setMinutes] = useState<DelayMinutes | null>(null);
  const [reason, setReason] = useState<DelayReason | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try { setJourney((await getShiftJourney(organizationId, shiftId, token)).journey); } catch { /* card stays hidden */ }
  }, [organizationId, shiftId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

  const start = new Date(scheduledStart).getTime();
  const opensAt = start - WINDOW_BEFORE_MS;
  const inWindow = now >= opensAt && now <= start + WINDOW_AFTER_MS;

  function explain(e: unknown, fallback: string) {
    const err = e as ApiError;
    show(err?.isNetworkError ? "Sin señal. Inténtalo de nuevo en un momento: no se envió." : (err?.code && JOURNEY_ERROR_TEXT[err.code]) || fallback, "danger");
  }

  async function goOnTheWay() {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try {
      const r = await declareEnRoute(organizationId, shiftId, token);
      setJourney(r.journey);
      show("Listo: la agencia y la familia saben que vas en camino.", "success");
      onChanged?.();
    } catch (e) { explain(e, "No se pudo avisar. Inténtalo de nuevo."); void load(); }
    finally { setBusy(false); }
  }

  async function sendDelay() {
    const token = getToken();
    if (!token || !minutes || !reason) return;
    setBusy(true);
    try {
      const r = await reportDelay(organizationId, shiftId, minutes, reason, token);
      setJourney(r.journey);
      setDelayOpen(false);
      show("Retraso informado a la agencia y a la familia.", "success");
    } catch (e) { explain(e, "No se pudo informar el retraso."); }
    finally { setBusy(false); }
  }

  if (!journey || !["ASSIGNED", "EN_ROUTE"].includes(journey.state)) return null;
  const enRoute = journey.state === "EN_ROUTE";

  return (
    <Card className="flex flex-col gap-3" aria-label="En camino" data-testid="caregiver-journey">
      <div className="flex items-start gap-3">
        <Navigation size={22} className={`mt-0.5 shrink-0 ${enRoute ? "text-[var(--color-success-700)]" : "text-[var(--color-navy-900)]"}`} aria-hidden />
        <div className="min-w-0 flex-1">
          {enRoute
            ? <><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-[var(--color-text-primary)]">En camino desde las {time(journey.enRouteAt!)}</p><Badge tone="success">En camino</Badge></div>
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">La agencia y la familia lo saben. Al llegar, toca «Llegué».</p></>
            : <><p className="font-medium text-[var(--color-text-primary)]">¿Ya vas para allá?</p>
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
                  {inWindow ? "Avisa a la agencia y a la familia. No se usa tu ubicación."
                    : now < opensAt ? `Podrás avisar desde las ${time(new Date(opensAt).toISOString())}.` : "El tiempo para avisar ya pasó; toca «Llegué» al llegar."}
                </p></>}
          {journey.delay && <p className="mt-1 flex items-center gap-1.5 text-[var(--text-small)] text-[var(--color-warning-700)]" data-testid="caregiver-delay">
            <Clock size={15} aria-hidden /> Retraso informado: unos {journey.delay.minutes}{journey.delay.minutes === 60 ? "+" : ""} min · {DELAY_REASON_TEXT[journey.delay.reason]}</p>}
        </div>
      </div>
      {inWindow && <div className={enRoute ? "" : "grid grid-cols-1 gap-2"}>
        {!enRoute && <Button size="lg" fullWidth icon={<Navigation size={20} />} loading={busy} onClick={() => void goOnTheWay()}>Voy en camino</Button>}
        <Button variant={enRoute ? "secondary" : "ghost"} fullWidth={!enRoute} disabled={busy} icon={<Clock size={18} />}
          onClick={() => { setMinutes(null); setReason(null); setDelayOpen(true); }}>Informar retraso</Button>
      </div>}

      <Modal open={delayOpen} onClose={() => !busy && setDelayOpen(false)} title="Informar retraso"
        footer={<div className="flex w-full items-center gap-2 sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => setDelayOpen(false)}>Cancelar</Button>
          <Button className="flex-1 sm:flex-none" loading={busy} disabled={!minutes || !reason} onClick={() => void sendDelay()}>Informar</Button>
        </div>}>
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-2 text-[var(--text-small)] font-medium">¿Cuánto tiempo, más o menos?</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {DELAY_MINUTES.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)}
                  className={`min-h-11 rounded-[var(--radius-md)] border px-2 text-[var(--text-small)] font-medium ${minutes === m ? "border-[var(--color-navy-900)] bg-[var(--color-navy-900)] text-white" : "border-[var(--color-border)] bg-white"}`}>
                  {m === 60 ? "60+ min" : `${m} min`}
                </button>))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-[var(--text-small)] font-medium">Motivo</legend>
            <div className="flex flex-col gap-2" role="radiogroup">
              {(Object.keys(DELAY_REASON_TEXT) as DelayReason[]).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)}
                  className={`min-h-11 rounded-[var(--radius-md)] border px-3 text-left text-[var(--text-small)] ${reason === r ? "border-[var(--color-navy-900)] bg-[var(--color-ivory-100)] font-medium" : "border-[var(--color-border)] bg-white"}`}>
                  {DELAY_REASON_TEXT[r]}
                </button>))}
            </div>
          </fieldset>
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">La familia verá que informaste un retraso aproximado; no es una hora de llegada.</p>
        </div>
      </Modal>
    </Card>
  );
}

import { useState } from "react";
import { MapPinCheck, ShieldCheck } from "lucide-react";
import type { ApiError } from "@/api/client";
import type { ShiftArrival } from "@/api/shifts";
import { getLocationConsent, grantLocationConsent, recordArrival, type Arrival } from "@/api/serviceLocations";
import { getToken } from "@/auth/token";
import { Button, Card, Modal, useToast } from "@/components/ui";
import { isConnectivityError, queuedJourneyState, useCareEventQueue } from "@/features/caregiver/careEventQueue";
import { PROXIMITY_TEXT } from "./arrivalText";

const time = (v: string) => new Date(v).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });

/** One reading, only after consent; never watches or tracks. Resolves to null when there is no reading. */
function oneReading(): Promise<{ latitude: number; longitude: number; accuracyM: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

/**
 * «Llegué» (Gate 6): optional, before «Comenzar turno». With the caregiver's
 * separate consent the phone takes ONE reading; the server keeps only whether it
 * was near. Without consent or GPS the arrival is still recorded for review:
 * nothing here ever blocks starting the shift.
 */
export function ArrivalCard({ organizationId, shiftId, arrival, onRecorded }: {
  organizationId: string; shiftId: string; arrival: ShiftArrival | Arrival | null; onRecorded: () => void;
}) {
  const { show } = useToast();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const queue = useCareEventQueue();
  const queuedArrival = queuedJourneyState(queue.items, shiftId).arrived;

  /** No signal: keep «Llegué» with its real time; no location is read or stored while offline. */
  async function queueArrival() {
    try {
      const result = await queue.arrive(organizationId, shiftId);
      show(result === "sent" ? "Llegada registrada." : "Sin señal: tu llegada quedó guardada con la hora real y se enviará sola. La agencia la revisará porque no se pudo verificar la ubicación.",
        result === "sent" ? "success" : "warning");
      if (result === "sent") onRecorded();
    } catch (e) {
      show((e as ApiError)?.code === "ALREADY_ARRIVED" ? "Tu llegada ya estaba registrada." : "No se pudo registrar la llegada. Puedes comenzar el turno igualmente.", "danger");
    }
  }

  async function send(withReading: boolean) {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try {
      const reading = withReading ? await oneReading() : null;
      const result = await recordArrival(organizationId, shiftId, reading, token);
      show(result.needsReview ? `Llegada registrada. ${PROXIMITY_TEXT[result.proximity]}.` : "Llegada registrada.", result.needsReview ? "warning" : "success");
      onRecorded();
    } catch (e) {
      const err = e as ApiError;
      if (isConnectivityError(e)) { await queueArrival(); return; }
      show(err?.code === "ALREADY_ARRIVED" ? "Tu llegada ya estaba registrada."
        : err?.code === "ARRIVAL_OUTSIDE_WINDOW" ? "Podrás registrar tu llegada desde 2 horas antes del inicio del turno."
        : "No se pudo registrar la llegada. Puedes comenzar el turno igualmente.", "danger");
    } finally { setBusy(false); setAsking(false); }
  }

  async function start() {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try {
      const consent = await getLocationConsent(organizationId, token);
      setBusy(false);
      if (consent.granted) await send(true);
      else setAsking(true);
    } catch (e) {
      setBusy(false);
      // No signal: the consent cannot be checked, so no location is read; the arrival is queued.
      if (isConnectivityError(e) || navigator.onLine === false) { setBusy(true); await queueArrival(); setBusy(false); return; }
      setAsking(true);
    }
  }

  async function allow() {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try { await grantLocationConsent(organizationId, token); await send(true); }
    catch { setBusy(false); show("No se pudo guardar tu consentimiento. Registra la llegada sin ubicación.", "danger"); }
  }

  if (!arrival && queuedArrival) {
    return (
      <Card className="flex items-start gap-3" aria-label="Llegada" data-testid="arrival-pending-sync">
        <MapPinCheck size={22} className="mt-0.5 shrink-0 text-[var(--color-warning-700)]" aria-hidden />
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Llegada guardada · por enviar</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Se enviará sola al recuperar la señal. Ya puedes comenzar el turno.</p>
        </div>
      </Card>
    );
  }
  if (arrival) {
    return (
      <Card className="flex items-start gap-3" aria-label="Llegada">
        <MapPinCheck size={22} className="mt-0.5 shrink-0 text-[var(--color-success-700)]" aria-hidden />
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Llegada registrada · {time(arrival.occurredAt)}</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{PROXIMITY_TEXT[arrival.proximity]}</p>
        </div>
      </Card>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-2">
        <Button size="lg" variant="secondary" fullWidth icon={<MapPinCheck size={20} />} loading={busy} onClick={() => void start()}>Llegué</Button>
        <p className="text-center text-[var(--text-caption)] text-[var(--color-text-muted)]">Opcional: avisa a la agencia que ya estás en el lugar.</p>
      </div>
      <Modal open={asking} onClose={() => !busy && setAsking(false)} title="Verificar tu llegada"
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => void send(false)}>Registrar sin ubicación</Button>
          <Button loading={busy} onClick={() => void allow()}>Permitir verificación</Button>
        </div>}>
        <div className="space-y-2 text-[var(--text-small)]">
          <p className="flex items-start gap-2"><ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
            Al tocar «Llegué», tu teléfono leerá tu ubicación <strong>una sola vez</strong> para confirmar que estás cerca del lugar del servicio.</p>
          <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-secondary)]">
            <li>No te seguimos ni guardamos tu recorrido.</li>
            <li>ETNARA guarda solo «cerca» o «lejos» y una distancia aproximada, no tus coordenadas.</li>
            <li>Puedes retirar este permiso en tu perfil.</li>
            <li>Si no lo permites, tu llegada se registra igual y la agencia la revisa. Nunca te impide trabajar.</li>
          </ul>
        </div>
      </Modal>
    </>
  );
}

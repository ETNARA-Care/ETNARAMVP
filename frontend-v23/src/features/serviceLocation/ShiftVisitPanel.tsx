import { useCallback, useEffect, useState } from "react";
import { Clock, MapPin } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { hasOrgFeature } from "@/auth/orgFeatures";
import { getToken } from "@/auth/token";
import { getShiftServiceLocation, reviewArrival, type ShiftServiceLocation } from "@/api/serviceLocations";
import { getVisitVerification, type VisitVerification } from "@/api/shifts";
import { Badge, Button, Card, Modal, Textarea, useToast } from "@/components/ui";
import { minutesLate, PROXIMITY_TEXT } from "./arrivalText";
import { serviceAddressText } from "./navigation";

const time = (v: string) => new Date(v).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" });
/**
 * Agency view of one shift's visit (Gate 6): confirmed address, real times of
 * «Llegué», start and finish, lateness, and the administrative review of
 * arrivals without a near location check.
 */
export function ShiftVisitPanel({ organizationId, shiftId, scheduledStart, cancelled, workerName }: {
  organizationId: string; shiftId: string; scheduledStart: string; cancelled: boolean; workerName: (membershipId: string) => string;
}) {
  const { show } = useToast();
  // «Llegué» is offered only with «En camino» (backend 108): without it, a start without arrival is normal.
  const { activeOrganization } = useAuth();
  const arrivalOffered = hasOrgFeature(activeOrganization?.features, "EN_CAMINO");
  const [location, setLocation] = useState<ShiftServiceLocation | null | undefined>(undefined);
  const [visit, setVisit] = useState<VisitVerification | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const [loc, v] = await Promise.all([
      getShiftServiceLocation(organizationId, shiftId, token).catch(() => null),
      getVisitVerification(organizationId, shiftId, token).catch(() => null),
    ]);
    setLocation(loc); setVisit(v); setLoadedAt(Date.now());
  }, [organizationId, shiftId]);
  useEffect(() => { void load(); }, [load]);

  async function submitReview() {
    const token = getToken();
    if (!token || !reviewing || !note.trim()) return;
    setBusy(true);
    try { await reviewArrival(organizationId, shiftId, reviewing, note.trim(), token); show("Revisión registrada.", "success"); setReviewing(null); setNote(""); }
    catch { show("No se pudo registrar la revisión.", "danger"); }
    finally { setBusy(false); await load(); }
  }

  const arrivals = visit?.arrivals ?? [];
  const checkIns = (visit?.events ?? []).filter((e) => e.eventType === "check_in");
  const checkOuts = (visit?.events ?? []).filter((e) => e.eventType === "check_out");
  const arrivedMemberships = new Set(arrivals.map((a) => a.membershipId));
  const firstAt = [...arrivals.map((a) => a.occurredAt), ...checkIns.map((e) => e.occurredAt)].sort()[0] ?? null;
  const late = cancelled || !loadedAt ? null : minutesLate(scheduledStart, firstAt, loadedAt);
  const started = new Date(scheduledStart).getTime() <= loadedAt;

  return (
    <>
      <Card aria-label="Lugar del servicio">
        <div className="flex items-start gap-3">
          <MapPin size={22} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium text-[var(--color-text-primary)]">Lugar del servicio{location ? ` · ${location.label}` : ""}</p>
            {location === undefined ? <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Cargando…</p>
              : location ? <>
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{serviceAddressText(location) || "Ubicación marcada en el mapa"}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {!location.verified && <Badge tone="warning">Dirección sin verificar</Badge>}
                  {location.gpsConfirmed ? <Badge tone="success">GPS confirmado</Badge> : <Badge tone="warning">GPS sin confirmar · navegación aproximada</Badge>}
                </div>
              </> : <p className="text-[var(--text-small)] text-[var(--color-warning-700)]">Sin dirección registrada para este turno.</p>}
          </div>
        </div>
      </Card>

      <Card aria-label="Llegada y registro">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]"><Clock size={20} aria-hidden /> Llegada y registro</p>
          {late !== null && <Badge tone="danger">{!firstAt ? `Sin llegada · ${late} min` : arrivals.length ? `Llegó ${late} min tarde` : `Inició ${late} min tarde`}</Badge>}
        </div>
        <ul className="space-y-2 text-[var(--text-small)]">
          {arrivals.map((a) => (
            <li key={a.membershipId} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2">
              <p><strong>{workerName(a.membershipId)}</strong> · Llegué {time(a.occurredAt)}{a.recordedOffline ? " · sin conexión" : ""}</p>
              <p className="text-[var(--color-text-secondary)]">{PROXIMITY_TEXT[a.proximity]}{a.distanceM != null ? ` (~${a.distanceM} m)` : ""}</p>
              {a.needsReview && !a.reviewedAt && <div className="mt-1 flex items-center justify-between gap-2">
                <Badge tone="warning">Pendiente de revisión</Badge>
                <Button size="md" variant="secondary" onClick={() => { setNote(""); setReviewing(a.membershipId); }}>Revisar</Button>
              </div>}
              {a.reviewedAt && <p className="mt-1 text-[var(--text-caption)] text-[var(--color-text-muted)]">Revisada {time(a.reviewedAt)}: {a.reviewNote}</p>}
            </li>
          ))}
          {checkIns.map((e) => <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Inicio del turno: <strong>{time(e.occurredAt)}</strong>{e.recordedOffline ? " · sin conexión" : ""}</span>
            {arrivalOffered && !(e.membershipId && arrivedMemberships.has(e.membershipId)) && <span data-testid="started-without-arrival"><Badge tone="warning">Inició sin «Llegué»</Badge></span>}
          </li>)}
          {checkOuts.map((e) => <li key={e.id}>Finalización: <strong>{time(e.occurredAt)}</strong>{e.recordedOffline ? " · sin conexión" : ""}</li>)}
          {!arrivals.length && !checkIns.length && <li className="text-[var(--color-text-muted)]">{started ? "Aún no hay llegada registrada." : "El turno no ha comenzado."}</li>}
        </ul>
      </Card>

      <Modal open={reviewing !== null} onClose={() => !busy && setReviewing(null)} title="Revisar llegada"
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => setReviewing(null)}>Volver</Button>
          <Button loading={busy} disabled={!note.trim()} onClick={() => void submitReview()}>Guardar revisión</Button>
        </div>}>
        <p className="text-[var(--text-small)]">La llegada no se pudo confirmar por ubicación. Anota cómo la verificaste (llamada, familiar, supervisión). El turno nunca se bloqueó.</p>
        <div className="mt-3"><Textarea label="Nota de revisión" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </Modal>
    </>
  );
}

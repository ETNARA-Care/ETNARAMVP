import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, Bath, Check, ClipboardList, Eye, Footprints, GlassWater, LogIn, LogOut, MessageCircle, Smile, TriangleAlert, Utensils, X } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { hasOrgFeature } from "@/auth/orgFeatures";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import { listShiftCareEvents, type CareEvent, type CareEventTypeCode } from "@/api/careEvents";
import { isConnectivityError, queuedVisitState, useCareEventQueue } from "@/features/caregiver/careEventQueue";
import { createIncident } from "@/api/incidents";
import {
  getActiveCarePlan,
  supportLevelLabels,
  taskCategoryLabels,
  taskFrequencyLabels,
  type CarePlan,
  type CarePlanTaskPriority,
} from "@/api/carePlans";
import {
  getVisitVerification, listCareRecipients, listMyShifts, recipientName, respondToAssignment,
  type CareRecipient, type Shift, type ShiftStatus, type VisitVerification,
} from "@/api/shifts";
import { getShiftServiceLocation, type ShiftServiceLocation } from "@/api/serviceLocations";
import { ServiceDirectionsCard } from "@/features/serviceLocation/ServiceDirectionsCard";
import { ArrivalCard } from "@/features/serviceLocation/ArrivalCard";
import { CaregiverJourneyCard } from "@/features/journey/CaregiverJourneyCard";
import { PROXIMITY_TEXT } from "@/features/serviceLocation/arrivalText";
import { OfflineReadyCard } from "@/features/caregiver/OfflineReady";
import { Badge, BottomSheet, Button, Card, ErrorState, Input, Select, Skeleton, StatusBadge, Textarea, Timeline, useToast } from "@/components/ui";
import { ShiftPrivateInstructions } from "@/features/shifts/ShiftPrivateInstructions";
import {
  getActivityPhoto, getActivityPhotoEligibility, getShiftPhotoEligibility, photoErrorMessage, uploadActivityPhoto, type ActivityPhotoRef,
} from "@/api/activityPhotos";
import { PhotoPicker, type PhotoEligibility } from "@/features/activityPhotos/PhotoPicker";
import { ActivityPhotoThumb } from "@/features/activityPhotos/ActivityPhotoThumb";
import type { PreparedPhoto } from "@/features/activityPhotos/preparePhoto";

const ACTIONS: Array<{ code: CareEventTypeCode; label: string; icon: ReactNode }> = [
  { code: "MEAL", label: "Comida", icon: <Utensils size={22} /> },
  { code: "HYDRATION", label: "Hidratación", icon: <GlassWater size={22} /> },
  { code: "TOILETING", label: "Higiene", icon: <Bath size={22} /> },
  { code: "MOBILITY", label: "Movilidad", icon: <Footprints size={22} /> },
  { code: "ACTIVITY", label: "Actividad", icon: <Activity size={22} /> },
  { code: "MOOD", label: "Ánimo", icon: <Smile size={22} /> },
  { code: "NOTE", label: "Observación", icon: <Eye size={22} /> },
];

const ACTION_LABEL: Record<CareEventTypeCode, string> = Object.fromEntries(
  ACTIONS.map((action) => [action.code, action.label]),
) as Record<CareEventTypeCode, string>;

const ACTION_TITLE: Record<CareEventTypeCode, string> = Object.fromEntries(
  ACTIONS.map((action) => [action.code, "Registrar " + action.label.toLowerCase()]),
) as Record<CareEventTypeCode, string>;

function actionError(error: unknown): string {
  const apiError = error as ApiError;
  if (apiError.status === 0) return "No hay conexión con el servidor.";
  if (apiError.code === "ALREADY_CHECKED_IN") return "Este turno ya fue iniciado.";
  if (apiError.code === "ASSIGNMENT_NOT_ACCEPTED") return "Debes aceptar el turno antes de comenzarlo.";
  if (apiError.code === "ASSIGNMENT_ALREADY_RESPONDED") return "Esta asignación ya fue respondida.";
  // Capa 1: solo ella recibe este aviso; no dice de qué agencia ni qué turno.
  if (apiError.code === "MY_SCHEDULE_CONFLICT") return "Ya tienes otro turno confirmado en ese horario.";
  if (apiError.code === "NO_ACTIVE_CHECK_IN") return "No encontramos una llegada activa para finalizar.";
  if (apiError.code === "NO_ACTIVE_VISIT") return "Debes comenzar el turno antes de registrar cuidados.";
  if (apiError.code === "EVENT_TYPE_NOT_ENABLED") return "Esta acción no está habilitada para la organización.";
  if (apiError.code === "NOT_FOUND") return "Este turno ya no está asignado a tu cuenta.";
  // Unexpected server error: a short reference so the agency can find it in the log.
  if (apiError.errorId) return `No pudimos registrar la acción. Intenta nuevamente. Código: ${apiError.errorId.slice(0, 8)}`;
  return "No pudimos registrar la acción. Intenta nuevamente.";
}

function effectiveStatus(shift: Shift, verification: VisitVerification): ShiftStatus {
  if (verification.status === "in_progress") return "in_progress";
  if (verification.status === "completed") return "completed";
  return shift.status;
}

function dataOf(event: CareEvent): Record<string, unknown> {
  return event.structured_data && typeof event.structured_data === "object"
    ? event.structured_data as Record<string, unknown>
    : {};
}

function careEventSummary(event: CareEvent): string {
  const data = dataOf(event);
  if (event.type_code === "MEAL") return "Comida · " + String(data.mealType ?? "") + " · " + String(data.amountConsumed ?? "");
  if (event.type_code === "HYDRATION") return "Agua · " + String(data.amount ?? "");
  if (event.type_code === "TOILETING") return "Baño / aseo · " + String(data.result ?? "");
  if (event.type_code === "MOBILITY") return "Movilidad · " + String(data.activity ?? "");
  if (event.type_code === "ACTIVITY") return "Actividad · " + String(data.label ?? "");
  if (event.type_code === "MOOD") return "Estado de ánimo · " + String(data.mood ?? "");
  return "Observación · " + (event.note_text || "registrada");
}

function taskPriorityLabel(priority: CarePlanTaskPriority): string {
  if (priority === "CRITICAL") return "Crítica";
  if (priority === "IMPORTANT") return "Importante";
  return "Rutinaria";
}

export function CaregiverShiftDetailPage() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  // «En camino» y «Llegué»: solo agencias piloto (backend 108). Sin ellos, el turno sigue con Comenzar / Finalizar.
  const enCamino = hasOrgFeature(activeOrganization?.features, "EN_CAMINO");
  const smartMatch = hasOrgFeature(activeOrganization?.features, "SMARTMATCH");
  // Activity photos (backend #208): only agencies with ACTIVITY_PHOTOS; otherwise nothing changes.
  const photosOn = hasOrgFeature(activeOrganization?.features, "ACTIVITY_PHOTOS");
  const { show } = useToast();
  const [shift, setShift] = useState<Shift | null>(null);
  const [recipient, setRecipient] = useState<CareRecipient | undefined>();
  const [verification, setVerification] = useState<VisitVerification | null>(null);
  const [careEvents, setCareEvents] = useState<CareEvent[]>([]);
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);
  const [location, setLocation] = useState<ShiftServiceLocation | null>(null);
  const [error, setError] = useState<boolean | "offline">(false);
  /** Gate 7: the agency cancelled the visit or took this caregiver off it while the screen was open. */
  const [goneNotice, setGoneNotice] = useState<"cancelled" | "unassigned" | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeAction, setActiveAction] = useState<CareEventTypeCode | null>(null);
  const [mealType, setMealType] = useState("Desayuno");
  const [mealAmount, setMealAmount] = useState("Todo");
  const [hydrationAmount, setHydrationAmount] = useState("Vaso completo");
  const [toiletingResult, setToiletingResult] = useState("Sin novedad");
  const [mobilityActivity, setMobilityActivity] = useState("Caminata corta");
  const [activityLabel, setActivityLabel] = useState("");
  const [activityDuration, setActivityDuration] = useState("");
  const [mood, setMood] = useState("Tranquilo");
  const [note, setNote] = useState("");
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentSeverity, setIncidentSeverity] = useState("Moderado");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentActions, setIncidentActions] = useState("");
  const [rejectionOpen, setRejectionOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [photoEligibility, setPhotoEligibility] = useState<PhotoEligibility>("loading");
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  /** Photos of this shift's activities that she uploaded (event id → photo). */
  const [eventPhotos, setEventPhotos] = useState<Record<string, ActivityPhotoRef>>({});
  /** Activity saved but its photo did not go up: kept in memory only, to retry while the screen is open. */
  const [photoRetry, setPhotoRetry] = useState<{ eventId: string; title: string; photo: PreparedPhoto } | null>(null);
  const organizationId = activeOrganization?.id;
  const queue = useCareEventQueue();
  const queuedHere = useMemo(() => queue.items.filter((item) => item.shiftId === shiftId), [queue.items, shiftId]);
  const waitingHere = queuedHere.filter((item) => item.status !== "failed");
  const failedHere = queuedHere.filter((item) => item.status === "failed");
  // Llegada o salida guardada en el teléfono que aún no llega al servidor.
  const queuedVisit = shiftId ? queuedVisitState(queue.items, shiftId) : null;

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !shiftId || !token) return;
    setError(false);
    try {
      const [shiftRows, summary, recipientRows, eventRows] = await Promise.all([
        listMyShifts(organizationId, token),
        getVisitVerification(organizationId, shiftId, token),
        listCareRecipients(organizationId, token),
        listShiftCareEvents(organizationId, shiftId, token),
      ]);
      const shiftRow = shiftRows.find((item) => item.id === shiftId);
      if (!shiftRow) throw new Error("SHIFT_NOT_ASSIGNED");
      const [carePlanRow, locationRow] = shiftRow.care_recipient_id
        ? await Promise.all([
          getActiveCarePlan(organizationId, shiftRow.care_recipient_id, token),
          // Gate 6: la dirección confirmada de ESTE turno. Es ayuda, no bloquea el turno si falla.
          getShiftServiceLocation(organizationId, shiftRow.id, token).catch(() => null),
        ])
        : [null, null];
      setShift(shiftRow);
      setVerification(summary);
      setRecipient(recipientRows.find((item) => item.id === shiftRow.care_recipient_id));
      setCareEvents(eventRows);
      if (photosOn) {
        // Her photos for this shift's records (404 = none). Never blocks the screen.
        const refs = await Promise.all(eventRows.map((event) =>
          getActivityPhoto(organizationId, event.id, token).then((ref) => [event.id, ref] as const).catch(() => [event.id, null] as const)));
        setEventPhotos(Object.fromEntries(refs.filter(([, ref]) => ref).map(([id, ref]) => [id, ref as ActivityPhotoRef])));
      }
      setCarePlan(carePlanRow);
      setLocation(locationRow);
      setError(false);
    } catch (loadError) {
      setError(isConnectivityError(loadError) ? "offline" : true);
    }
  }, [organizationId, shiftId, photosOn]);

  // Only «can she attach a photo here?» — asked again each time the record sheet opens.
  useEffect(() => {
    if (!photosOn || !activeAction || !organizationId || !shiftId) return;
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    getShiftPhotoEligibility(organizationId, shiftId, token)
      .then((allowed) => { if (!cancelled) setPhotoEligibility(allowed ? "allowed" : "blocked"); })
      .catch(() => { if (!cancelled) setPhotoEligibility("blocked"); });
    return () => { cancelled = true; };
  }, [photosOn, activeAction, organizationId, shiftId]);

  // También se recarga cuando un registro pendiente llega al servidor.
  const deliveredVersion = queue.deliveredVersion;
  useEffect(() => { void load(); }, [load, deliveredVersion]);

  const timelineEntries = useMemo(() => [
    ...(verification?.events ?? []).map((event) => ({
      id: event.id,
      at: event.occurredAt,
      title: (event.eventType === "check_in" ? "Llegada registrada · turno iniciado" : "Salida registrada · turno finalizado")
        + (event.recordedOffline ? " · sin conexión" : ""),
    })),
    ...(verification?.arrivals ?? []).map((arrival) => ({
      id: `arrival-${arrival.occurredAt}`, at: arrival.occurredAt, title: `Llegué · ${PROXIMITY_TEXT[arrival.proximity]}`,
    })),
    ...careEvents.map((event) => ({ id: event.id, at: event.occurred_at, title: careEventSummary(event) + (eventPhotos[event.id] ? " · con foto" : "") })),
    ...queuedHere.map((item) => ({
      id: item.clientEventId,
      at: item.input.occurredAt ?? new Date().toISOString(),
      title: `${item.label} · ${item.status === "failed" ? "no se pudo enviar" : "guardada sin señal, pendiente de enviar"}`,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at)).map((event) => ({
    id: event.id,
    time: new Date(event.at).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" }),
    title: event.title,
  })), [careEvents, verification, queuedHere, eventPhotos]);

  async function startShift() {
    const token = getToken();
    if (!organizationId || !shiftId || !token) return;
    setSaving(true);
    try {
      const outcome = await queue.checkIn(organizationId, shiftId);
      if (outcome === "queued") show("Sin señal. Tu llegada quedó guardada con la hora real y se enviará sola.", "warning");
      else { show("Llegada registrada. Turno iniciado.", "success"); await load(); }
    } catch (requestError) { show(actionError(requestError), "danger"); }
    finally { setSaving(false); }
  }

  async function finishShift() {
    const token = getToken();
    if (!organizationId || !shiftId || !token) return;
    setSaving(true);
    try {
      const outcome = await queue.checkOut(organizationId, shiftId);
      show(outcome === "queued" ? "Sin señal. Tu salida quedó guardada con la hora real y se enviará sola." : "Salida registrada. Turno finalizado.", outcome === "queued" ? "warning" : "success");
      navigate("/caregiver/shifts");
    } catch (requestError) { show(actionError(requestError), "danger"); }
    finally { setSaving(false); }
  }

  async function respond(decision: "accepted" | "rejected") {
    const token = getToken();
    if (!organizationId || !shiftId || !token) return;
    setSaving(true);
    try {
      await respondToAssignment(
        organizationId,
        shiftId,
        decision,
        decision === "rejected" ? rejectionReason : undefined,
        token,
      );
      if (decision === "rejected") {
        show("Turno rechazado. Administración fue notificada.", "success");
        navigate("/caregiver/shifts");
        return;
      }
      show("Turno aceptado. Administración fue notificada.", "success");
      await load();
    } catch (requestError) {
      show(actionError(requestError), "danger");
    } finally {
      setSaving(false);
      setRejectionOpen(false);
    }
  }

  function carePayload(): { payload?: Record<string, unknown>; noteText?: string } {
    if (activeAction === "MEAL") return { payload: { mealType, amountConsumed: mealAmount }, ...(note.trim() ? { noteText: note.trim() } : {}) };
    if (activeAction === "HYDRATION") return { payload: { amount: hydrationAmount }, ...(note.trim() ? { noteText: note.trim() } : {}) };
    if (activeAction === "TOILETING") return { payload: { result: toiletingResult }, ...(note.trim() ? { noteText: note.trim() } : {}) };
    if (activeAction === "MOBILITY") return { payload: { activity: mobilityActivity }, ...(note.trim() ? { noteText: note.trim() } : {}) };
    if (activeAction === "ACTIVITY") {
      const minutes = Number(activityDuration);
      return { payload: { label: activityLabel.trim(), ...(minutes > 0 ? { durationMinutes: minutes } : {}) }, ...(note.trim() ? { noteText: note.trim() } : {}) };
    }
    if (activeAction === "MOOD") return { payload: { mood }, ...(note.trim() ? { noteText: note.trim() } : {}) };
    return { noteText: note.trim() };
  }

  const careReady = activeAction !== "NOTE" && activeAction !== "ACTIVITY"
    ? Boolean(activeAction)
    : activeAction === "NOTE" ? Boolean(note.trim()) : Boolean(activityLabel.trim());

  /** Uploads the photo of a saved activity. The server checks everything again (consent may have changed). */
  async function sendPhoto(eventId: string, title: string, prepared: PreparedPhoto): Promise<boolean> {
    const token = getToken();
    if (!organizationId || !token) return false;
    try {
      const ref = await uploadActivityPhoto(organizationId, eventId, prepared.blob, prepared.contentType, token);
      setEventPhotos((current) => ({ ...current, [eventId]: ref }));
      setPhotoRetry(null);
      return true;
    } catch (photoError) {
      const message = photoErrorMessage(photoError);
      const code = (photoError as ApiError)?.code;
      // Only a retryable failure keeps the photo (in memory) for «Reintentar foto».
      const retryable = (photoError as ApiError)?.status === 0 || code === "PHOTO_BUSY" || code === "PHOTO_STORAGE_NOT_CONFIGURED" || !!(photoError as ApiError)?.errorId;
      setPhotoRetry(retryable ? { eventId, title, photo: prepared } : null);
      show(`La actividad se guardó, pero la foto no. ${message}`, "warning");
      return false;
    }
  }

  async function retryPhoto() {
    if (!photoRetry || !organizationId) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      // Ask first: the activity may be too old, already have a photo, or the consent may have changed.
      const allowed = await getActivityPhotoEligibility(organizationId, photoRetry.eventId, token).catch(() => true);
      if (!allowed) {
        setPhotoRetry(null);
        show("Ya no se puede añadir una foto a esa actividad.", "warning");
        return;
      }
      if (await sendPhoto(photoRetry.eventId, photoRetry.title, photoRetry.photo)) show("Foto enviada. La agencia la revisará antes de compartirla con la familia.", "success");
    } finally { setSaving(false); }
  }

  async function saveCareEvent() {
    const token = getToken();
    if (!organizationId || !shiftId || !token || !activeAction || !shift?.care_recipient_id || !careReady) return;
    setSaving(true);
    try {
      const input = { typeCode: activeAction, careRecipientId: shift.care_recipient_id, ...carePayload() };
      const withPhoto = photosOn && photoEligibility === "allowed" && photo;
      const { outcome, eventId } = withPhoto
        ? await queue.submitWithEventId({ organizationId, shiftId, label: ACTION_LABEL[activeAction], input })
        : { outcome: await queue.submit({ organizationId, shiftId, label: ACTION_LABEL[activeAction], input }), eventId: undefined };
      if (outcome === "queued") {
        // Privacy: a photo is never stored on the phone. The record goes when the signal is back.
        show(withPhoto
          ? "Sin señal. La actividad se enviará al volver la señal. La foto no se guardó: tómala de nuevo cuando tengas señal."
          : "Sin señal. Se guardó y se enviará solo cuando vuelva la señal.", "warning");
      } else if (withPhoto && eventId) {
        if (await sendPhoto(eventId, ACTION_LABEL[activeAction], withPhoto)) {
          show("Actividad guardada con foto. La agencia la revisará antes de compartirla con la familia.", "success");
        }
      } else {
        show(ACTION_TITLE[activeAction] + " completado.", "success");
      }
      setPhoto(null);
      setActiveAction(null);
      setNote("");
      setActivityLabel("");
      setActivityDuration("");
      if (outcome === "sent") await load();
    } catch (requestError) { show(actionError(requestError), "danger"); }
    finally { setSaving(false); }
  }

  async function saveIncident() {
    const token = getToken();
    if (!organizationId || !shift?.care_recipient_id || !token || !incidentDescription.trim()) return;
    setSaving(true);
    try {
      await createIncident(organizationId, {
        careRecipientId: shift.care_recipient_id,
        severity: incidentSeverity,
        description: incidentDescription.trim(),
        ...(incidentActions.trim() ? { actionsTaken: incidentActions.trim() } : {}),
      }, token);
      show("Incidente reportado correctamente.", "success");
      setIncidentOpen(false);
      setIncidentDescription("");
      setIncidentActions("");
    } catch (requestError) {
      show(actionError(requestError), "danger");
    } finally {
      setSaving(false);
    }
  }

  if (goneNotice === "cancelled" && (error || shift?.status === "cancelled")) {
    // After a cancellation the visit is no longer readable by the caregiver: say why instead of "not found".
    return (
      <Card className="flex flex-col gap-3" data-testid="shift-cancelled-notice" role="status">
        <p className="font-medium text-[var(--color-text-primary)]">La agencia canceló esta visita</p>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">No tienes que ir. Si ya estabas en camino, comunícate con la agencia.</p>
        <Button variant="secondary" onClick={() => navigate("/caregiver/shifts")}>Ver mis turnos</Button>
      </Card>
    );
  }
  if (goneNotice === "unassigned") {
    return (
      <Card className="flex flex-col gap-3" data-testid="shift-unassigned-notice" role="status">
        <p className="font-medium text-[var(--color-text-primary)]">Ya no tienes asignado este turno</p>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">La agencia cambió la persona asignada. No tienes que ir; si ya estabas en camino, comunícate con la agencia.</p>
        <Button variant="secondary" onClick={() => navigate("/caregiver/shifts")}>Ver mis turnos</Button>
      </Card>
    );
  }
  if (error) return <ErrorState kind={error === "offline" ? "offline" : "not_found"} onRetry={() => void load()} />;
  if (!shift || !verification) return <div className="flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-32" /></div>;

  const status: ShiftStatus = queuedVisit === "checked_out" ? "completed" : queuedVisit === "checked_in" ? "in_progress" : effectiveStatus(shift, verification);
  const assignmentAccepted = shift.assignment_response_status === "accepted";
  const assignmentPending = shift.assignment_response_status === "pending";
  const visitStatus = queuedVisit === "checked_out" ? "completed" : queuedVisit === "checked_in" ? "in_progress" : verification.status;
  const canStart = assignmentAccepted && visitStatus === "not_started" && shift.status !== "cancelled" && shift.status !== "completed";
  const canFinish = visitStatus === "in_progress";
  // Solo si la cola se guarda en el teléfono se puede finalizar con pendientes:
  // la salida se envía después de ellos, en orden.
  const finishBlocked = waitingHere.length > 0 && !queue.persisted;

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <button type="button" onClick={() => navigate("/caregiver/shifts")} className="w-fit text-sm font-medium text-[var(--color-text-secondary)]">← Turnos</button>
      <section className={`rounded-[var(--radius-lg)] p-5 shadow-sm ${canFinish ? "bg-[var(--color-navy-900)] text-white" : "border border-[var(--color-border)] bg-white"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${canFinish ? "text-white/60" : "text-[var(--color-text-muted)]"}`}>{canFinish ? "Turno activo" : "Detalle del turno"}</p>
            <h1 className="mt-1 truncate font-[var(--font-serif)] text-2xl">{recipientName(recipient)}</h1>
          </div>
          {canFinish
            ? <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">En curso</span>
            : <StatusBadge status={status} />}
        </div>
        <p className={`mt-4 font-medium ${canFinish ? "text-white" : "text-[var(--color-text-primary)]"}`}>{new Date(shift.scheduled_start).toLocaleDateString("es-PR", { weekday: "long", day: "numeric", month: "long" })}</p>
        <p className={`text-sm ${canFinish ? "text-white/70" : "text-[var(--color-text-secondary)]"}`}>
          {new Date(shift.scheduled_start).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – {new Date(shift.scheduled_end).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
        </p>
      </section>

      {smartMatch && organizationId && shiftId && <ShiftPrivateInstructions organizationId={organizationId} shiftId={shiftId} editable={false} />}

      {assignmentPending && (
        <Card className="flex flex-col gap-3">
          <div>
            <Badge tone="warning">Respuesta pendiente</Badge>
            <p className="font-medium text-[var(--color-text-primary)] mt-2">¿Puedes cubrir este turno?</p>
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Confirma tu disponibilidad antes de comenzar.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="danger" icon={<X size={18} />} disabled={saving} onClick={() => setRejectionOpen(true)}>Rechazar</Button>
            <Button icon={<Check size={18} />} disabled={saving} onClick={() => void respond("accepted")}>Aceptar</Button>
          </div>
        </Card>
      )}

      {enCamino && canStart && organizationId && shiftId && !verification.arrivals?.length && (
        // Gate 7: «Voy en camino» before the directions; remounts (and hides) once the arrival exists.
        <CaregiverJourneyCard key={`journey-${verification.arrivals?.length ?? 0}`} organizationId={organizationId} shiftId={shiftId} scheduledStart={shift.scheduled_start}
          onGone={(reason) => {
            setGoneNotice(reason);
            if (reason === "cancelled") show("La agencia canceló esta visita. No tienes que ir.", "warning");
            void load();
          }} />
      )}

      {status !== "completed" && status !== "cancelled" && <ServiceDirectionsCard location={location} />}

      {enCamino && canStart && organizationId && shiftId && (
        <ArrivalCard organizationId={organizationId} shiftId={shiftId} arrival={verification.arrivals?.[0] ?? null} onRecorded={() => void load()} />
      )}

      {organizationId && <OfflineReadyCard organizationId={organizationId} shift={shift} />}

      {canStart && (
        <div className="flex flex-col gap-2">
          <Button size="lg" fullWidth icon={<LogIn size={20} />} disabled={saving} onClick={() => void startShift()}>{saving ? "Registrando llegada..." : "Comenzar turno"}</Button>
          <p className="text-center text-[var(--text-caption)] text-[var(--color-text-muted)]">Al comenzar se registra tu llegada y podrás anotar los cuidados.</p>
        </div>
      )}

      {canFinish && (
        <div>
          <div className="mb-3"><p className="font-semibold text-[var(--color-navy-900)]">Registrar cuidado</p><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Toca lo que acabas de hacer.</p></div>
          <div className="grid grid-cols-3 gap-2.5">
            {ACTIONS.map((action) => (
              <button
                key={action.code}
                type="button"
                disabled={saving}
                onClick={() => { setPhotoEligibility("loading"); setActiveAction(action.code); }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-3.5 min-h-[76px] text-[var(--text-caption)] font-medium text-[var(--color-text-primary)] transition-transform active:scale-95 disabled:opacity-40"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {canFinish && (
        <Button variant="danger" fullWidth icon={<TriangleAlert size={18} />} disabled={saving} onClick={() => setIncidentOpen(true)}>
          Reportar incidente
        </Button>
      )}

      <Card>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2"><ClipboardList size={20} /><p className="font-medium text-[var(--color-text-primary)]">Plan de cuidado</p></div>
          {carePlan && <Badge tone={carePlan.plan_details.supportLevel === "COMPLEX" || carePlan.plan_details.supportLevel === "HIGH" ? "warning" : "accent"}>{supportLevelLabels[carePlan.plan_details.supportLevel]}</Badge>}
        </div>
        {!carePlan ? <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Administración todavía no ha publicado un plan para este residente.</p> : (
          <div className="flex flex-col gap-3">
            {carePlan.plan_details.precautions.length > 0 && (
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-warning-100)] p-3">
                <p className="text-[var(--text-caption)] font-semibold text-[var(--color-warning-700)] uppercase tracking-wide">Precauciones</p>
                <ul className="list-disc pl-5 mt-1 text-[var(--text-small)] text-[var(--color-text-primary)]">{carePlan.plan_details.precautions.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            )}
            {carePlan.plan_details.instructions.length > 0 && (
              <div><p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Instrucciones</p><ul className="list-disc pl-5 mt-1 text-[var(--text-small)] text-[var(--color-text-primary)]">{carePlan.plan_details.instructions.map((item) => <li key={item}>{item}</li>)}</ul></div>
            )}
            <div>
              <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mb-2">Tareas de este cuidado</p>
              {carePlan.plan_details.tasks.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No hay tareas específicas.</p> : (
                <div className="flex flex-col gap-2">
                  {carePlan.plan_details.tasks.map((task) => (
                    <div key={task.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                      <div className="flex items-start justify-between gap-2"><p className="font-medium text-[var(--color-text-primary)]">{task.title}</p><Badge tone={task.priority === "CRITICAL" ? "danger" : task.priority === "IMPORTANT" ? "warning" : "neutral"}>{taskPriorityLabel(task.priority)}</Badge></div>
                      <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)] mt-1">{taskCategoryLabels[task.category]} · {taskFrequencyLabels[task.frequency]}{task.timeOfDay ? ` · ${task.timeOfDay}` : ""}</p>
                      {task.details && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-2">{task.details}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {failedHere.length > 0 && (
        <Card className="flex flex-col gap-2 border-red-200 bg-red-50">
          <p className="font-medium text-red-900">{failedHere.length === 1 ? "1 registro no se pudo enviar" : `${failedHere.length} registros no se pudieron enviar`}</p>
          {failedHere.map((item) => (
            <div key={item.clientEventId} className="flex items-center justify-between gap-3 text-sm text-red-900">
              <span>{item.label} · {item.failure}</span>
              <button type="button" className="min-h-11 shrink-0 rounded-xl px-3 font-semibold" onClick={() => queue.discard(item.clientEventId)}>Quitar</button>
            </div>
          ))}
          <p className="text-xs text-red-800">Avisa a Administración para que lo registre.</p>
        </Card>
      )}

      {canFinish && (
        <div className="flex flex-col gap-2">
          <Button size="lg" fullWidth icon={<LogOut size={20} />} disabled={saving || finishBlocked} onClick={() => setFinishOpen(true)}>Finalizar turno</Button>
          {waitingHere.length > 0 && <p className="text-center text-[var(--text-caption)] text-amber-800">
            {finishBlocked
              ? `Tienes ${waitingHere.length === 1 ? "1 registro" : `${waitingHere.length} registros`} por enviar. Podrás finalizar cuando vuelva la señal.`
              : `${waitingHere.length === 1 ? "1 registro guardado" : `${waitingHere.length} registros guardados`} sin señal. Se envían solos, antes de tu salida.`}
          </p>}
        </div>
      )}

      <Button variant="secondary" icon={<MessageCircle size={18} />} onClick={() => navigate("/caregiver/messages")}>Enviar mensaje sobre {recipientName(recipient)}</Button>

      {photosOn && photoRetry && (
        <Card className="flex flex-col gap-2 border-amber-200 bg-amber-50" data-testid="activity-photo-retry">
          <p className="font-medium text-amber-900">La foto de «{photoRetry.title}» no se envió</p>
          <p className="text-sm text-amber-900">Se guarda solo mientras esta pantalla esté abierta.</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={() => void retryPhoto()}>Reintentar foto</Button>
            <Button size="sm" variant="secondary" disabled={saving} onClick={() => setPhotoRetry(null)}>Descartar</Button>
          </div>
        </Card>
      )}

      {photosOn && organizationId && Object.keys(eventPhotos).length > 0 && (
        <Card data-testid="activity-photos-shift">
          <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-3">Fotos de este turno</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {careEvents.filter((event) => eventPhotos[event.id]).map((event) => (
              <ActivityPhotoThumb key={event.id} organizationId={organizationId} photo={eventPhotos[event.id]} title={ACTION_LABEL[event.type_code] ?? "Actividad"} />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-3">Actividad del turno</p>
        {timelineEntries.length > 0 ? <Timeline entries={timelineEntries} /> : <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Aún no se ha registrado la llegada.</p>}
      </Card>

      <BottomSheet
        open={finishOpen}
        onClose={() => !saving && setFinishOpen(false)}
        title="Finalizar turno"
        footer={<><Button variant="secondary" fullWidth disabled={saving} onClick={() => setFinishOpen(false)}>Volver</Button><Button fullWidth disabled={saving} onClick={() => void finishShift()}>{saving ? "Finalizando..." : "Confirmar y finalizar"}</Button></>}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Resumen del turno</p>
            <p className="mt-2 font-semibold text-[var(--color-navy-900)]">{careEvents.length} registro{careEvents.length === 1 ? "" : "s"} de cuidado</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{timelineEntries.length} evento{timelineEntries.length === 1 ? "" : "s"} en la actividad del turno.</p>
          </div>
          {carePlan && carePlan.plan_details.tasks.length > 0 && <div><p className="font-medium text-[var(--color-navy-900)]">Plan de cuidado</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{carePlan.plan_details.tasks.length} tarea{carePlan.plan_details.tasks.length === 1 ? "" : "s"} publicada{carePlan.plan_details.tasks.length === 1 ? "" : "s"} para este cuidado.</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">ETNARA no marcará tareas como completadas automáticamente si no existe un registro que lo confirme.</p></div>}
          <p className="text-sm text-[var(--color-text-secondary)]">Al confirmar, se registrará tu salida real y el turno quedará finalizado.</p>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!activeAction}
        onClose={() => { if (!saving) { setActiveAction(null); setPhoto(null); } }}
        title={activeAction ? ACTION_TITLE[activeAction] : ""}
        footer={<><Button variant="secondary" fullWidth disabled={saving} onClick={() => { setActiveAction(null); setPhoto(null); }}>Cancelar</Button><Button fullWidth disabled={saving || !careReady} onClick={() => void saveCareEvent()}>{saving ? "Guardando..." : "Guardar"}</Button></>}
      >
        <div className="flex flex-col gap-3">
          {activeAction === "MEAL" && <><Select label="Tipo de comida" value={mealType} onChange={(event) => setMealType(event.target.value)}><option>Desayuno</option><option>Almuerzo</option><option>Cena</option><option>Snack</option></Select><Select label="Cantidad consumida" value={mealAmount} onChange={(event) => setMealAmount(event.target.value)}><option>Poco</option><option>Mitad</option><option>Casi todo</option><option>Todo</option></Select></>}
          {activeAction === "HYDRATION" && <Select label="Cantidad de líquido" value={hydrationAmount} onChange={(event) => setHydrationAmount(event.target.value)}><option>Rechazó</option><option>Poco</option><option>Medio vaso</option><option>Vaso completo</option></Select>}
          {activeAction === "TOILETING" && <Select label="Resultado" value={toiletingResult} onChange={(event) => setToiletingResult(event.target.value)}><option>Sin novedad</option><option>Asistencia parcial</option><option>Asistencia total</option><option>Requirió cambio</option></Select>}
          {activeAction === "MOBILITY" && <Select label="Actividad realizada" value={mobilityActivity} onChange={(event) => setMobilityActivity(event.target.value)}><option>No realizada</option><option>Caminata corta</option><option>Caminata 15 minutos</option><option>Con asistencia</option><option>Silla de ruedas</option></Select>}
          {activeAction === "ACTIVITY" && <><Input label="Descripción de la actividad" value={activityLabel} onChange={(event) => setActivityLabel(event.target.value)} placeholder="Ej. Música o caminata" required /><Input label="Duración en minutos (opcional)" type="number" min={1} value={activityDuration} onChange={(event) => setActivityDuration(event.target.value)} /></>}
          {activeAction === "MOOD" && <Select label="Estado observado" value={mood} onChange={(event) => setMood(event.target.value)}><option>Contento</option><option>Tranquilo</option><option>Triste</option><option>Ansioso</option><option>Confundido</option><option>Irritable</option><option>Somnoliento</option></Select>}
          <Textarea label={activeAction === "NOTE" ? "Observación" : "Nota adicional (opcional)"} value={note} onChange={(event) => setNote(event.target.value)} required={activeAction === "NOTE"} placeholder="Detalles..." />
          {photosOn && <PhotoPicker eligibility={photoEligibility} value={photo} onChange={setPhoto} disabled={saving} />}
        </div>
      </BottomSheet>

      <BottomSheet
        open={incidentOpen}
        onClose={() => !saving && setIncidentOpen(false)}
        title="Reportar incidente"
        footer={<><Button variant="secondary" fullWidth disabled={saving} onClick={() => setIncidentOpen(false)}>Cancelar</Button><Button variant="danger" fullWidth disabled={saving || !incidentDescription.trim()} onClick={() => void saveIncident()}>{saving ? "Enviando..." : "Enviar reporte"}</Button></>}
      >
        <div className="flex flex-col gap-3">
          <Select label="Severidad" value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value)}>
            <option>Leve</option>
            <option>Moderado</option>
            <option>Grave</option>
            <option>Crítico</option>
          </Select>
          <Textarea label="¿Qué ocurrió?" value={incidentDescription} onChange={(event) => setIncidentDescription(event.target.value)} required placeholder="Describe lo ocurrido con claridad..." />
          <Textarea label="Acciones tomadas (opcional)" value={incidentActions} onChange={(event) => setIncidentActions(event.target.value)} placeholder="Ej. Se notificó al supervisor..." />
          <div className="rounded-[var(--radius-sm)] bg-[var(--color-ivory-100)] p-3">
            <p className="text-[var(--text-caption)] font-medium text-[var(--color-text-secondary)]">Al confirmar, ETNARA guardará el incidente usando el registro real de la organización. No se añadirá información que no hayas escrito.</p>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={rejectionOpen}
        onClose={() => !saving && setRejectionOpen(false)}
        title="Rechazar turno"
        footer={<><Button variant="secondary" fullWidth disabled={saving} onClick={() => setRejectionOpen(false)}>Cancelar</Button><Button variant="danger" fullWidth disabled={saving} onClick={() => void respond("rejected")}>{saving ? "Enviando..." : "Confirmar rechazo"}</Button></>}
      >
        <Textarea label="Motivo (opcional)" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} placeholder="Ej. Conflicto de horario" />
      </BottomSheet>
    </div>
  );
}

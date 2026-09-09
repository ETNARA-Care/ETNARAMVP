import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, Bath, Eye, Footprints, GlassWater, LogIn, LogOut, MessageCircle, Smile, TriangleAlert, Utensils } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import { createCareEvent, listShiftCareEvents, type CareEvent, type CareEventTypeCode } from "@/api/careEvents";
import { createIncident } from "@/api/incidents";
import {
  checkIn, checkOut, getShift, getVisitVerification, listCareRecipients, recipientName,
  type CareRecipient, type Shift, type ShiftStatus, type VisitVerification,
} from "@/api/shifts";
import { BottomSheet, Button, Card, ErrorState, Input, PageHeader, Select, Skeleton, StatusBadge, Textarea, Timeline, useToast } from "@/components/ui";

const ACTIONS: Array<{ code: CareEventTypeCode; label: string; icon: ReactNode }> = [
  { code: "MEAL", label: "Comida", icon: <Utensils size={22} /> },
  { code: "HYDRATION", label: "Agua", icon: <GlassWater size={22} /> },
  { code: "TOILETING", label: "Baño / aseo", icon: <Bath size={22} /> },
  { code: "MOBILITY", label: "Movilidad", icon: <Footprints size={22} /> },
  { code: "ACTIVITY", label: "Actividad", icon: <Activity size={22} /> },
  { code: "MOOD", label: "Estado de ánimo", icon: <Smile size={22} /> },
  { code: "NOTE", label: "Observación", icon: <Eye size={22} /> },
];

const ACTION_TITLE: Record<CareEventTypeCode, string> = Object.fromEntries(
  ACTIONS.map((action) => [action.code, "Registrar " + action.label.toLowerCase()]),
) as Record<CareEventTypeCode, string>;

function actionError(error: unknown): string {
  const apiError = error as ApiError;
  if (apiError.status === 0) return "No hay conexión con el servidor.";
  if (apiError.code === "ALREADY_CHECKED_IN") return "Este turno ya fue iniciado.";
  if (apiError.code === "NO_ACTIVE_CHECK_IN") return "No encontramos una llegada activa para finalizar.";
  if (apiError.code === "NO_ACTIVE_VISIT") return "Debes comenzar el turno antes de registrar cuidados.";
  if (apiError.code === "EVENT_TYPE_NOT_ENABLED") return "Esta acción no está habilitada para la organización.";
  if (apiError.code === "NOT_FOUND") return "Este turno ya no está asignado a tu cuenta.";
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

export function CaregiverShiftDetailPage() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const { show } = useToast();
  const [shift, setShift] = useState<Shift | null>(null);
  const [recipient, setRecipient] = useState<CareRecipient | undefined>();
  const [verification, setVerification] = useState<VisitVerification | null>(null);
  const [careEvents, setCareEvents] = useState<CareEvent[]>([]);
  const [error, setError] = useState(false);
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
  const organizationId = activeOrganization?.id;

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !shiftId || !token) return;
    setError(false);
    try {
      const [shiftRow, summary, recipientRows, eventRows] = await Promise.all([
        getShift(organizationId, shiftId, token),
        getVisitVerification(organizationId, shiftId, token),
        listCareRecipients(organizationId, token),
        listShiftCareEvents(organizationId, shiftId, token),
      ]);
      setShift(shiftRow);
      setVerification(summary);
      setRecipient(recipientRows.find((item) => item.id === shiftRow.care_recipient_id));
      setCareEvents(eventRows);
    } catch {
      setError(true);
    }
  }, [organizationId, shiftId]);

  useEffect(() => { void load(); }, [load]);

  const timelineEntries = useMemo(() => [
    ...(verification?.events ?? []).map((event) => ({
      id: event.id,
      at: event.occurredAt,
      title: event.eventType === "check_in" ? "Llegada registrada · turno iniciado" : "Salida registrada · turno finalizado",
    })),
    ...careEvents.map((event) => ({ id: event.id, at: event.occurred_at, title: careEventSummary(event) })),
  ].sort((a, b) => a.at.localeCompare(b.at)).map((event) => ({
    id: event.id,
    time: new Date(event.at).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" }),
    title: event.title,
  })), [careEvents, verification]);

  async function startShift() {
    const token = getToken();
    if (!organizationId || !shiftId || !token) return;
    setSaving(true);
    try {
      await checkIn(organizationId, shiftId, token);
      show("Llegada registrada. Turno iniciado.", "success");
      await load();
    } catch (requestError) { show(actionError(requestError), "danger"); }
    finally { setSaving(false); }
  }

  async function finishShift() {
    const token = getToken();
    if (!organizationId || !shiftId || !token) return;
    setSaving(true);
    try {
      await checkOut(organizationId, shiftId, token);
      show("Salida registrada. Turno finalizado.", "success");
      navigate("/caregiver/shifts");
    } catch (requestError) { show(actionError(requestError), "danger"); }
    finally { setSaving(false); }
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

  async function saveCareEvent() {
    const token = getToken();
    if (!organizationId || !shiftId || !token || !activeAction || !shift?.care_recipient_id || !careReady) return;
    setSaving(true);
    try {
      await createCareEvent(organizationId, shiftId, {
        typeCode: activeAction,
        careRecipientId: shift.care_recipient_id,
        ...carePayload(),
      }, token);
      show(ACTION_TITLE[activeAction] + " completado.", "success");
      setActiveAction(null);
      setNote("");
      setActivityLabel("");
      setActivityDuration("");
      await load();
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

  if (error) return <ErrorState kind="not_found" onRetry={() => void load()} />;
  if (!shift || !verification) return <div className="flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-32" /></div>;

  const status = effectiveStatus(shift, verification);
  const canStart = verification.status === "not_started" && status !== "cancelled" && status !== "completed";
  const canFinish = verification.status === "in_progress";

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <PageHeader title={recipientName(recipient)} breadcrumbs={[{ label: "Turnos", href: "/caregiver/shifts" }, { label: "Detalle" }]} actions={<StatusBadge status={status} />} />

      <Card>
        <p className="font-medium text-[var(--color-text-primary)]">{new Date(shift.scheduled_start).toLocaleDateString("es-PR", { weekday: "long", day: "numeric", month: "long" })}</p>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
          {new Date(shift.scheduled_start).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – {new Date(shift.scheduled_end).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" icon={<LogIn size={18} />} disabled={!canStart || saving} onClick={() => void startShift()}>Comenzar turno</Button>
        <Button variant="secondary" size="lg" icon={<LogOut size={18} />} disabled={!canFinish || saving} onClick={() => void finishShift()}>Finalizar turno</Button>
      </div>

      <div>
        <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-3">Registrar cuidado</p>
        <div className="grid grid-cols-3 gap-2.5">
          {ACTIONS.map((action) => (
            <button
              key={action.code}
              disabled={!canFinish || saving}
              onClick={() => setActiveAction(action.code)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-3.5 min-h-[76px] text-[var(--text-caption)] font-medium text-[var(--color-text-primary)] transition-transform active:scale-95 disabled:opacity-40"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
        {!canFinish && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-2">Comienza el turno para registrar cuidados.</p>}
      </div>

      <Button
        variant="danger"
        fullWidth
        icon={<TriangleAlert size={18} />}
        disabled={!canFinish || saving}
        onClick={() => setIncidentOpen(true)}
      >
        Reportar incidente
      </Button>

      <Button variant="secondary" icon={<MessageCircle size={18} />} onClick={() => navigate("/caregiver/messages")}>Enviar mensaje sobre {recipientName(recipient).split(" ")[0]}</Button>

      <Card>
        <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-3">Actividad del turno</p>
        {timelineEntries.length > 0 ? <Timeline entries={timelineEntries} /> : <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Aún no se ha registrado la llegada.</p>}
      </Card>

      <BottomSheet
        open={!!activeAction}
        onClose={() => !saving && setActiveAction(null)}
        title={activeAction ? ACTION_TITLE[activeAction] : ""}
        footer={<><Button variant="secondary" fullWidth disabled={saving} onClick={() => setActiveAction(null)}>Cancelar</Button><Button fullWidth disabled={saving || !careReady} onClick={() => void saveCareEvent()}>{saving ? "Guardando..." : "Guardar"}</Button></>}
      >
        <div className="flex flex-col gap-3">
          {activeAction === "MEAL" && <><Select label="Tipo de comida" value={mealType} onChange={(event) => setMealType(event.target.value)}><option>Desayuno</option><option>Almuerzo</option><option>Cena</option><option>Snack</option></Select><Select label="Cantidad consumida" value={mealAmount} onChange={(event) => setMealAmount(event.target.value)}><option>Poco</option><option>Mitad</option><option>Casi todo</option><option>Todo</option></Select></>}
          {activeAction === "HYDRATION" && <Select label="Cantidad de líquido" value={hydrationAmount} onChange={(event) => setHydrationAmount(event.target.value)}><option>Rechazó</option><option>Poco</option><option>Medio vaso</option><option>Vaso completo</option></Select>}
          {activeAction === "TOILETING" && <Select label="Resultado" value={toiletingResult} onChange={(event) => setToiletingResult(event.target.value)}><option>Sin novedad</option><option>Asistencia parcial</option><option>Asistencia total</option><option>Requirió cambio</option></Select>}
          {activeAction === "MOBILITY" && <Select label="Actividad realizada" value={mobilityActivity} onChange={(event) => setMobilityActivity(event.target.value)}><option>No realizada</option><option>Caminata corta</option><option>Caminata 15 minutos</option><option>Con asistencia</option><option>Silla de ruedas</option></Select>}
          {activeAction === "ACTIVITY" && <><Input label="Descripción de la actividad" value={activityLabel} onChange={(event) => setActivityLabel(event.target.value)} placeholder="Ej. Música o caminata" required /><Input label="Duración en minutos (opcional)" type="number" min={1} value={activityDuration} onChange={(event) => setActivityDuration(event.target.value)} /></>}
          {activeAction === "MOOD" && <Select label="Estado observado" value={mood} onChange={(event) => setMood(event.target.value)}><option>Contento</option><option>Tranquilo</option><option>Triste</option><option>Ansioso</option><option>Confundido</option><option>Irritable</option><option>Somnoliento</option></Select>}
          <Textarea label={activeAction === "NOTE" ? "Observación" : "Nota adicional (opcional)"} value={note} onChange={(event) => setNote(event.target.value)} required={activeAction === "NOTE"} placeholder="Detalles..." />
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
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Este reporte quedará registrado y notificará a Administración.</p>
        </div>
      </BottomSheet>
    </div>
  );
}

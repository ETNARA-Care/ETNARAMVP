import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getOrgShift, listOrgCareRecipients, type OrgShift, type OrgCareRecipient } from "../../api/agency";
import { checkIn, checkOut, getVisitVerification, type VisitVerificationSummary } from "../../api/verification";
import { listShiftCareEvents, type CareEvent, type CareEventTypeCode } from "../../api/careEvents";
import { listObservations, type Observation } from "../../api/observations";
import { listIncidents, type Incident } from "../../api/incidents";
import { LoadingState, ErrorState } from "../../components/UiStates";
import { Card, ScreenHeader } from "../../components/Primitives";
import { Badge, type BadgeTone } from "../../components/Badge";
import {
  MealIcon,
  HydrationIcon,
  BathIcon,
  ActivityIcon,
  MoodIcon,
  NoteIcon,
  CameraIcon,
  MessageIcon,
  AlertIcon,
} from "../../components/icons";
import { ApiError } from "../../api/client";

const CARE_EVENT_TYPES: Array<{ code: CareEventTypeCode; label: string; implemented: boolean; icon: typeof MealIcon }> = [
  { code: "MEAL", label: "Comida", implemented: true, icon: MealIcon },
  { code: "HYDRATION", label: "Hidratación", implemented: true, icon: HydrationIcon },
  { code: "TOILETING", label: "Baño / Aseo", implemented: true, icon: BathIcon },
  { code: "MOBILITY", label: "Movilidad", implemented: true, icon: ActivityIcon },
  { code: "ACTIVITY", label: "Actividad", implemented: true, icon: ActivityIcon },
  { code: "MOOD", label: "Estado de ánimo", implemented: true, icon: MoodIcon },
  { code: "NOTE", label: "Nota", implemented: true, icon: NoteIcon },
  { code: "PHOTO", label: "Foto", implemented: false, icon: CameraIcon },
];

function recipientName(r: OrgCareRecipient): string {
  return `${r.preferred_name ?? r.first_name} ${r.last_name}`;
}

function recipientContext(r: OrgCareRecipient): string[] {
  const bits: string[] = [];
  if (r.date_of_birth) {
    const years = Math.max(0, Math.floor((Date.now() - new Date(r.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)));
    if (years > 0) bits.push(`${years} años`);
  }
  bits.push(r.room_id ? `Habitación ${r.room_id}` : "Visita a domicilio");
  return bits;
}

function eventSummary(e: CareEvent): string {
  const data = (e.structured_data ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  switch (e.type_code) {
    case "MEAL":
      return [str(data.mealType), str(data.amountConsumed)].filter(Boolean).join(" · ") || "Comida registrada";
    case "HYDRATION":
      return str(data.amount) ? `Tomó: ${str(data.amount)}` : "Hidratación registrada";
    case "TOILETING":
      return str(data.result) ?? "Registro de baño";
    case "MOBILITY":
      return str(data.activity) ?? "Registro de movilidad";
    case "ACTIVITY": {
      const duration = typeof data.durationMinutes === "number" ? `${data.durationMinutes} min` : null;
      return [str(data.label), duration].filter(Boolean).join(" · ") || "Actividad registrada";
    }
    case "MOOD":
      return str(data.mood) ?? "Estado de ánimo registrado";
    case "NOTE":
      return e.note_text?.trim() || "Nota registrada";
    case "PHOTO":
      return "Foto registrada";
    default:
      return "Evento registrado";
  }
}

const EVENT_TITLES: Record<string, string> = {
  MEAL: "Comida",
  HYDRATION: "Hidratación",
  TOILETING: "Baño / Aseo",
  MOBILITY: "Movilidad",
  ACTIVITY: "Actividad",
  MOOD: "Estado de ánimo",
  NOTE: "Nota",
  PHOTO: "Foto",
};

function visitStatusBadge(status: VisitVerificationSummary["status"] | null): { label: string; tone: BadgeTone } {
  if (status === "completed") return { label: "Completado", tone: "verified" };
  if (status === "in_progress") return { label: "En curso", tone: "active" };
  return { label: "Pendiente", tone: "warning" };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function CaregiverShiftWorkspacePage() {
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const { shiftId } = useParams<{ shiftId: string }>();
  const organizationId = activeOrganization?.id;

  const [shift, setShift] = useState<OrgShift | null>(null);
  const [recipient, setRecipient] = useState<OrgCareRecipient | null>(null);
  const [status, setStatus] = useState<VisitVerificationSummary["status"] | null>(null);
  const [events, setEvents] = useState<CareEvent[] | null>(null);
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId || !shiftId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const shiftRes = await getOrgShift(organizationId!, shiftId!);
        if (cancelled) return;
        setShift(shiftRes);

        let recipientRow: OrgCareRecipient | null = null;
        if (shiftRes.care_recipient_id) {
          const all = await listOrgCareRecipients(organizationId!);
          recipientRow = all.find((r) => r.id === shiftRes.care_recipient_id) ?? null;
        } else if (shiftRes.room_id) {
          const all = await listOrgCareRecipients(organizationId!);
          recipientRow = all.find((r) => r.room_id === shiftRes.room_id) ?? null;
        }
        if (cancelled) return;
        setRecipient(recipientRow);

        const visit = await getVisitVerification(organizationId!, shiftId!).catch(
          (): VisitVerificationSummary => ({ shiftId: shiftId!, events: [], status: "not_started" })
        );
        if (cancelled) return;
        setStatus(visit.status);

        if (recipientRow) {
          const [shiftEvents, recipientObs, recipientIncidents] = await Promise.all([
            listShiftCareEvents(organizationId!, shiftId!).catch((): CareEvent[] => []),
            listObservations(organizationId!, { careRecipientId: recipientRow.id }).catch((): Observation[] => []),
            listIncidents(organizationId!, { careRecipientId: recipientRow.id }).catch((): Incident[] => []),
          ]);
          if (cancelled) return;
          setEvents([...shiftEvents].reverse());
          setObservations(recipientObs);
          setIncidents(recipientIncidents);
        }
      } catch {
        if (!cancelled) setError("No pudimos cargar la información de este turno.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, shiftId]);

  async function handleCheckIn() {
    if (!organizationId || !shiftId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await checkIn(organizationId, shiftId);
      setStatus("in_progress");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setActionError(
          err.code.startsWith("WORKER_NOT_ELIGIBLE")
            ? "No cumples los requisitos vigentes para iniciar este turno. Contacta a tu supervisor."
            : "Este turno no puede iniciarse en este momento."
        );
      } else {
        setActionError("No pudimos registrar tu llegada. Intenta de nuevo.");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!organizationId || !shiftId) return;
    if (!window.confirm("¿Confirmas que quieres finalizar la visita?")) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await checkOut(organizationId, shiftId);
      setStatus("completed");
    } catch {
      setActionError("No pudimos registrar tu salida. Intenta de nuevo.");
    } finally {
      setActionLoading(false);
    }
  }

  if (!organizationId || loading) return <LoadingState label="Cargando turno..." />;
  if (error) return <ErrorState description={error} />;
  if (!shift) return <ErrorState description="No encontramos este turno." />;

  const canLogCareEvents = status === "in_progress";
  const recipientQuery = recipient ? `?recipientId=${recipient.id}` : "";
  const badge = visitStatusBadge(status);
  const careSummary = {
    careEvents: events?.length ?? 0,
    observations: observations?.length ?? 0,
    incidents: incidents?.length ?? 0,
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 40 }}>
      <ScreenHeader
        title={recipient ? recipientName(recipient) : "Turno"}
        subtitle={recipient ? "Workspace vivo del turno en curso" : "No pudimos identificar al recipient de este turno"}
        onBack={() => navigate("/caregiver")}
      />

      <div style={{ padding: "0 var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Card style={{ padding: "var(--space-5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-body)",
                fontWeight: 600,
                color: "var(--color-ink)",
              }}
            >
              {formatTime(shift.scheduled_start)} → {formatTime(shift.scheduled_end)}
            </p>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>

          {actionError && (
            <p role="alert" style={{ color: "var(--color-critical)", fontSize: "var(--fs-caption)", margin: "0 0 var(--space-3)" }}>
              {actionError}
            </p>
          )}

          {status === "not_started" && shift.status !== "cancelled" && (
            <button
              onClick={handleCheckIn}
              disabled={actionLoading}
              style={{
                width: "100%",
                minHeight: "var(--tap-min)",
                fontWeight: 700,
                fontSize: "var(--fs-body)",
                background: "var(--color-verified)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? "Registrando..." : "Iniciar visita"}
            </button>
          )}
          {status === "in_progress" && (
            <button
              onClick={handleCheckOut}
              disabled={actionLoading}
              style={{
                width: "100%",
                minHeight: "var(--tap-min)",
                fontWeight: 700,
                fontSize: "var(--fs-body)",
                background: "var(--color-warning)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? "Registrando..." : "Finalizar visita"}
            </button>
          )}
          {status === "completed" && (
            <p style={{ margin: 0, color: "var(--color-verified)", fontWeight: 600, fontSize: "var(--fs-body)" }}>
              Visita completada · {events?.length ?? 0} {events?.length === 1 ? "cuidado registrado" : "cuidados registrados"}
            </p>
          )}
          {!canLogCareEvents && status !== "completed" && (
            <p style={{ margin: "var(--space-3) 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
              Inicia la visita para poder registrar comida, hidratación y otros cuidados de este turno.
            </p>
          )}
        </Card>

        {recipient && (
          <Card style={{ padding: "var(--space-5)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>Contexto útil del turno</p>
                <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                  {recipientContext(recipient).join(" · ")}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="neutral">{careSummary.careEvents} cuidados</Badge>
                <Badge tone="warning">{careSummary.observations} observaciones</Badge>
                <Badge tone={careSummary.incidents > 0 ? "critical" : "neutral"}>{careSummary.incidents} incidentes</Badge>
              </div>
            </div>
          </Card>
        )}

        {recipient && (
          <Card style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link
              to={`/messages${recipientQuery}`}
              style={{
                flex: "1 1 45%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                minHeight: "var(--tap-min)",
                textAlign: "center",
                fontWeight: 600,
                textDecoration: "none",
                color: "var(--color-ink)",
                background: "var(--color-ink-tint)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
              }}
            >
              <MessageIcon size={18} /> Enviar mensaje a la familia
            </Link>
            <Link
              to="/notifications"
              style={{
                flex: "1 1 45%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                minHeight: "var(--tap-min)",
                textAlign: "center",
                fontWeight: 600,
                textDecoration: "none",
                color: "var(--color-ink)",
                background: "var(--color-ink-tint)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
              }}
            >
              Notificaciones
            </Link>
          </Card>
        )}

        {!recipient && (
          <Card>
            <p style={{ margin: 0, color: "var(--color-ink-soft)", fontSize: "var(--fs-body)" }}>
              No pudimos identificar a la persona bajo cuidado de este turno todavía. Registrar cuidados, observaciones e
              incidentes no está disponible hasta que el turno tenga un recipient asignado.
            </p>
          </Card>
        )}

        {recipient && (
          <>
            <div>
              <p style={{ fontWeight: 700, fontSize: "var(--fs-title)", margin: "0 0 4px" }}>Registrar cuidado</p>
              <p style={{ margin: "0 0 10px", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                Usa solo acciones reales disponibles para esta visita.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 10,
                  opacity: canLogCareEvents ? 1 : 0.55,
                }}
              >
                {CARE_EVENT_TYPES.map((t) => {
                  const Icon = t.icon;
                  return t.implemented ? (
                    <Link
                      key={t.code}
                      to={canLogCareEvents ? `/caregiver/shifts/${shiftId}/care-events/${t.code}${recipientQuery}` : "#"}
                      aria-disabled={!canLogCareEvents}
                      onClick={(e) => {
                        if (!canLogCareEvents) e.preventDefault();
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        minHeight: 88,
                        textAlign: "center",
                        textDecoration: "none",
                        fontWeight: 600,
                        fontSize: "var(--fs-body)",
                        color: canLogCareEvents ? "var(--color-ink)" : "var(--color-ink-soft)",
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "14px 10px",
                        cursor: canLogCareEvents ? "pointer" : "not-allowed",
                      }}
                    >
                      <Icon size={26} />
                      {t.label}
                    </Link>
                  ) : (
                    <div
                      key={t.code}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        minHeight: 88,
                        textAlign: "center",
                        fontWeight: 600,
                        fontSize: "var(--fs-body)",
                        color: "var(--color-ink-soft)",
                        background: "var(--color-surface-muted)",
                        border: "1px dashed var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "14px 10px",
                      }}
                    >
                      <Icon size={26} />
                      {t.label}
                      <div style={{ fontSize: "var(--fs-caption)" }}>Próximamente</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Card style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link
                to={`/caregiver/shifts/${shiftId}/observations/new${recipientQuery}`}
                style={{
                  flex: "1 1 45%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: "var(--tap-min)",
                  textAlign: "center",
                  fontWeight: 600,
                  textDecoration: "none",
                  color: "var(--color-ink)",
                  background: "var(--color-ink-tint)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                }}
              >
                <NoteIcon size={18} /> Nueva observación
              </Link>
              <Link
                to={`/caregiver/shifts/${shiftId}/incidents/new${recipientQuery}`}
                style={{
                  flex: "1 1 45%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: "var(--tap-min)",
                  textAlign: "center",
                  fontWeight: 600,
                  textDecoration: "none",
                  color: "var(--color-critical)",
                  background: "var(--color-critical-bg)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                }}
              >
                <AlertIcon size={18} /> Reportar incidente
              </Link>
            </Card>

            <div>
              <p style={{ fontWeight: 700, fontSize: "var(--fs-title)", margin: "0 0 10px" }}>Actividad reciente de este turno</p>
              {events && events.length === 0 && (
                <p style={{ color: "var(--color-ink-soft)", fontSize: "var(--fs-body)" }}>
                  Todavía no has registrado cuidados en este turno.
                </p>
              )}
              {events?.slice(0, 10).map((e) => (
                <Card key={e.id} style={{ marginBottom: 8 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-body)" }}>{EVENT_TITLES[e.type_code ?? ""] ?? "Evento"}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>{eventSummary(e)}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", fontFamily: "var(--font-mono)" }}>
                    {formatTime(e.occurred_at)}
                  </p>
                </Card>
              ))}
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontWeight: 700, fontSize: "var(--fs-title)", margin: 0 }}>Observaciones</p>
                <Link
                  to={`/caregiver/shifts/${shiftId}/observations/new${recipientQuery}`}
                  style={{ fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink)" }}
                >
                  + Nueva observación
                </Link>
              </div>
              {observations && observations.length === 0 && (
                <p style={{ color: "var(--color-ink-soft)", fontSize: "var(--fs-body)" }}>Sin observaciones registradas.</p>
              )}
              {observations?.slice(0, 5).map((o) => (
                <Card key={o.id} style={{ marginBottom: 8 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-body)" }}>{o.category.replace(/_/g, " ")}</p>
                  {o.description && (
                    <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>{o.description}</p>
                  )}
                  <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                    Estado: {o.status === "open" ? "Pendiente de revisión" : o.status === "reviewed" ? "Revisada" : "Escalada a incidente"}
                  </p>
                </Card>
              ))}
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontWeight: 700, fontSize: "var(--fs-title)", margin: 0 }}>Incidentes</p>
                <Link
                  to={`/caregiver/shifts/${shiftId}/incidents/new${recipientQuery}`}
                  style={{ fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink)" }}
                >
                  + Reportar incidente
                </Link>
              </div>
              {incidents && incidents.length === 0 && (
                <p style={{ color: "var(--color-ink-soft)", fontSize: "var(--fs-body)" }}>Sin incidentes registrados.</p>
              )}
              {incidents?.slice(0, 5).map((i) => (
                <Card key={i.id} style={{ marginBottom: 8, borderLeft: "4px solid var(--color-critical)" }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-body)" }}>Severidad: {i.severity}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>{i.description}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                    Estado: {i.status === "open" ? "Abierto" : i.status === "in_progress" ? "En proceso" : "Resuelto"}
                  </p>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

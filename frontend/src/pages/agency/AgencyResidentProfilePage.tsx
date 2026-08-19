import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getOrgCareRecipient, listOrgShifts, type OrgCareRecipient, type OrgShift } from "../../api/agency";
import { listRecipientCareEvents, type CareEvent } from "../../api/careEvents";
import { listObservations, type Observation } from "../../api/observations";
import { listIncidents, type Incident } from "../../api/incidents";
import { Avatar, Card, ScreenHeader } from "../../components/Primitives";
import { Badge } from "../../components/Badge";
import { LoadingState, ErrorState } from "../../components/UiStates";

type FeedItem =
  | { id: string; occurredAt: string; kind: "care-event"; title: string; detail: string }
  | { id: string; occurredAt: string; kind: "observation"; title: string; detail: string }
  | { id: string; occurredAt: string; kind: "incident"; title: string; detail: string };

function initials(recipient: OrgCareRecipient): string {
  return `${(recipient.preferred_name ?? recipient.first_name)[0] ?? ""}${recipient.last_name[0] ?? ""}`.toUpperCase();
}

function ageLabel(dateOfBirth: string | null): string | null {
  if (!dateOfBirth) return null;
  const years = Math.max(0, Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)));
  return years > 0 ? `${years} años` : null;
}

function eventDetail(event: CareEvent): string {
  const data = (event.structured_data ?? {}) as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === "string" ? value : null);
  switch (event.type_code) {
    case "MEAL":
      return [str(data.mealType), str(data.amountConsumed)].filter(Boolean).join(" · ") || "Comida registrada";
    case "HYDRATION":
      return str(data.amount) ? `Tomó ${str(data.amount)}` : "Hidratación registrada";
    case "TOILETING":
      return str(data.result) ?? "Registro de baño / aseo";
    case "MOBILITY":
      return str(data.activity) ?? "Registro de movilidad";
    case "ACTIVITY":
      return str(data.label) ?? "Actividad registrada";
    case "MOOD":
      return str(data.mood) ?? "Estado de ánimo registrado";
    case "NOTE":
      return event.note_text?.trim() || "Nota registrada";
    default:
      return "Evento registrado";
  }
}

function eventTitle(typeCode?: string): string {
  switch (typeCode) {
    case "MEAL":
      return "Comida";
    case "HYDRATION":
      return "Hidratación";
    case "TOILETING":
      return "Baño / Aseo";
    case "MOBILITY":
      return "Movilidad";
    case "ACTIVITY":
      return "Actividad";
    case "MOOD":
      return "Estado de ánimo";
    case "NOTE":
      return "Nota";
    default:
      return "Cuidado";
  }
}

function feedTone(kind: FeedItem["kind"]) {
  if (kind === "incident") return "var(--color-critical)";
  if (kind === "observation") return "var(--color-warning)";
  return "var(--color-verified)";
}

function formatRange(shift: OrgShift) {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  return `${start.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })} · ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function AgencyResidentProfilePage() {
  const { activeOrganization } = useAuth();
  const { residentId } = useParams<{ residentId: string }>();
  const navigate = useNavigate();
  const organizationId = activeOrganization?.id;

  const [recipient, setRecipient] = useState<OrgCareRecipient | null>(null);
  const [careEvents, setCareEvents] = useState<CareEvent[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [shifts, setShifts] = useState<OrgShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId || !residentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const dateFrom = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const dateTo = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    Promise.all([
      getOrgCareRecipient(organizationId, residentId),
      listRecipientCareEvents(organizationId, residentId).catch((): CareEvent[] => []),
      listObservations(organizationId, { careRecipientId: residentId }).catch((): Observation[] => []),
      listIncidents(organizationId, { careRecipientId: residentId }).catch((): Incident[] => []),
      listOrgShifts(organizationId, { dateFrom, dateTo }).catch((): OrgShift[] => []),
    ])
      .then(([recipientRes, eventsRes, observationsRes, incidentsRes, shiftsRes]) => {
        if (cancelled) return;
        setRecipient(recipientRes);
        setCareEvents(eventsRes);
        setObservations(observationsRes);
        setIncidents(incidentsRes);
        setShifts(
          shiftsRes.filter(
            (shift) =>
              shift.care_recipient_id === residentId || (recipientRes.room_id && shift.room_id && shift.room_id === recipientRes.room_id)
          )
        );
      })
      .catch(() => !cancelled && setError("No pudimos cargar la información de esta persona."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [organizationId, residentId]);

  const feed = useMemo<FeedItem[]>(() => {
    const careFeed: FeedItem[] = careEvents.map((event) => ({
      id: event.id,
      occurredAt: event.occurred_at,
      kind: "care-event",
      title: eventTitle(event.type_code),
      detail: eventDetail(event),
    }));
    const observationFeed: FeedItem[] = observations.map((observation) => ({
      id: observation.id,
      occurredAt: observation.created_at,
      kind: "observation",
      title: "Observación",
      detail: observation.description?.trim() || observation.category.replace(/_/g, " "),
    }));
    const incidentFeed: FeedItem[] = incidents.map((incident) => ({
      id: incident.id,
      occurredAt: incident.created_at,
      kind: "incident",
      title: `Incidente · ${incident.severity}`,
      detail: incident.description,
    }));
    return [...careFeed, ...observationFeed, ...incidentFeed].sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
    );
  }, [careEvents, observations, incidents]);

  if (!organizationId || loading) return <LoadingState label="Cargando persona..." />;
  if (error) return <ErrorState description={error} />;
  if (!recipient) return <ErrorState description="No encontramos esta persona." />;

  const age = ageLabel(recipient.date_of_birth);
  const openObservations = observations.filter((observation) => observation.status === "open").length;
  const openIncidents = incidents.filter((incident) => incident.status !== "resolved").length;
  const nextShift = [...shifts]
    .filter((shift) => new Date(shift.scheduled_end).getTime() >= Date.now())
    .sort((left, right) => new Date(left.scheduled_start).getTime() - new Date(right.scheduled_start).getTime())[0];

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", paddingBottom: 32 }}>
      <ScreenHeader title={`${recipient.preferred_name ?? recipient.first_name} ${recipient.last_name}`} subtitle="Resumen real del recipient" onBack={() => navigate("/agency/personas")} />
      <div style={{ padding: "0 var(--space-6)", display: "grid", gap: "var(--space-4)" }}>
        <Card style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", borderRadius: "var(--radius-lg)" }}>
          <Avatar initials={initials(recipient)} color="var(--color-ink-tint)" size={60} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "var(--fs-title)", color: "var(--color-ink)" }}>
              {recipient.preferred_name ?? recipient.first_name} {recipient.last_name}
            </p>
            <p style={{ margin: "4px 0 0", color: "var(--color-ink-soft)", fontSize: "var(--fs-caption)" }}>
              {[age, recipient.room_id ? `Habitación ${recipient.room_id}` : "Visita a domicilio", recipient.status === "active" ? "Cuidado activo" : recipient.status]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Link
            to={`/messages?recipientId=${recipient.id}`}
            style={{
              textDecoration: "none",
              color: "var(--color-ink)",
              background: "var(--color-ink-tint)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              fontWeight: 700,
            }}
          >
            Mensajes
          </Link>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
          <Card style={{ borderRadius: "var(--radius-lg)" }}>
            <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>Cuidados registrados</p>
            <p style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: 30, color: "var(--color-ink)" }}>{careEvents.length}</p>
          </Card>
          <Card style={{ borderRadius: "var(--radius-lg)" }}>
            <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>Observaciones abiertas</p>
            <p style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: 30, color: "var(--color-warning)" }}>{openObservations}</p>
          </Card>
          <Card style={{ borderRadius: "var(--radius-lg)" }}>
            <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>Incidentes activos</p>
            <p style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: 30, color: "var(--color-critical)" }}>{openIncidents}</p>
          </Card>
          <Card style={{ borderRadius: "var(--radius-lg)" }}>
            <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>Próximo turno</p>
            <p style={{ margin: "6px 0 0", fontSize: "var(--fs-body)", color: "var(--color-ink)" }}>
              {nextShift ? formatRange(nextShift) : "Sin turno próximo visible"}
            </p>
          </Card>
        </div>

        <Card style={{ borderRadius: "var(--radius-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>Actividad reciente</p>
              <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                Timeline operativo construido con eventos de cuidado, observaciones e incidentes reales.
              </p>
            </div>
            <Badge tone="neutral">{feed.length} registros</Badge>
          </div>
          {feed.length === 0 && <p style={{ margin: 0, color: "var(--color-ink-soft)" }}>Todavía no hay actividad visible para esta persona.</p>}
          {feed.slice(0, 12).map((item) => (
            <div key={`${item.kind}-${item.id}`} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: "1px solid var(--color-border)" }}>
              <div style={{ width: 10, borderRadius: 999, background: feedTone(item.kind), flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>{item.title}</p>
                <p style={{ margin: "4px 0 0", color: "var(--color-ink-soft)" }}>{item.detail}</p>
                <p style={{ margin: "6px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", fontFamily: "var(--font-mono)" }}>
                  {new Date(item.occurredAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </Card>

        <Card style={{ borderRadius: "var(--radius-lg)" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>Pendiente de backend</p>
          <p style={{ margin: "6px 0 0", color: "var(--color-ink-soft)" }}>
            Plan de cuidado, contactos familiares, documentos y cuidador actual formal todavía no se muestran aquí para evitar datos simulados.
          </p>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { listMyCareRecipients, getFamilyTimeline, type MyRecipient, type TimelineItem } from "../../api/familyRecipients";
import {
  listFamilyIncidents,
  listFamilyObservations,
  listFamilyShifts,
  type FamilyIncident,
  type FamilyObservation,
  type FamilyShift,
} from "../../api/familyCare";
import { LoadingState, EmptyState, ErrorState } from "../../components/UiStates";
import { Card, Avatar } from "../../components/Primitives";
import { ApiError } from "../../api/client";

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  return `hace ${days} d`;
}

const observationLabels: Record<string, string> = {
  low_appetite: "Poco apetito",
  drowsiness: "Somnolencia",
  confusion: "Confusión",
  pain: "Dolor",
  behavior_change: "Cambio de comportamiento",
  reduced_mobility: "Movilidad reducida",
  elimination_change: "Cambio en eliminación",
  emotional_state: "Estado emocional",
  other: "Otra observación",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function relevantShift(shifts: FamilyShift[]): FamilyShift | null {
  const active = shifts.find((shift) => shift.checkedInAt && !shift.checkedOutAt);
  if (active) return active;
  const now = Date.now();
  const upcoming = shifts
    .filter((shift) => new Date(shift.scheduledEnd).getTime() >= now && shift.status !== "cancelled")
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
  return upcoming[0] ?? null;
}

function FamilyCareSummary({
  shifts,
  observations,
  incidents,
}: {
  shifts: FamilyShift[];
  observations: FamilyObservation[];
  incidents: FamilyIncident[];
}) {
  const shift = relevantShift(shifts);
  const latestObservation = observations[0];
  const activeIncidents = incidents.filter((incident) => incident.status !== "resolved");

  return (
    <section aria-labelledby="family-care-summary" style={{ marginBottom: 24 }}>
      <h2 id="family-care-summary" style={{ fontSize: "var(--fs-title)", margin: "0 0 12px" }}>
        Resumen de cuidado
      </h2>
      <div style={{ display: "grid", gap: 10 }}>
        <Card>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Turno</p>
          <p style={{ margin: 0, color: "var(--color-ink-soft)" }}>
            {!shift
              ? "No hay turnos próximos."
              : shift.checkedInAt && !shift.checkedOutAt
                ? `Cuidado en curso desde ${formatDateTime(shift.checkedInAt)}`
                : `Próximo cuidado: ${formatDateTime(shift.scheduledStart)}`}
          </p>
        </Card>
        <Card>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Observaciones revisadas</p>
          <p style={{ margin: 0, color: "var(--color-ink-soft)" }}>
            {latestObservation
              ? `${observationLabels[latestObservation.category] ?? "Observación"} · ${timeAgo(latestObservation.createdAt)}`
              : "No hay observaciones revisadas."}
          </p>
        </Card>
        <Card>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Incidentes</p>
          <p style={{ margin: 0, color: activeIncidents.length > 0 ? "var(--color-warning)" : "var(--color-ink-soft)" }}>
            {activeIncidents.length === 0
              ? "No hay incidentes activos."
              : `${activeIncidents.length} ${activeIncidents.length === 1 ? "incidente activo" : "incidentes activos"}.`}
          </p>
        </Card>
      </div>
    </section>
  );
}

function EventCard({ item }: { item: TimelineItem }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-title)", color: "var(--color-ink)" }}>{item.title}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
          {timeAgo(item.occurredAt)}
        </span>
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-body)", color: "var(--color-ink)", margin: "0 0 8px" }}>
        {item.summary}
      </p>
      {item.type === "PHOTO" && !item.photo?.visible && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", fontStyle: "italic" }}>
          Foto registrada — no disponible con tu nivel de acceso actual.
        </p>
      )}
      {item.caregiver.displayName && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", margin: 0 }}>
          Por {item.caregiver.displayName}
          {item.caregiver.role ? ` · ${item.caregiver.role}` : ""}
        </p>
      )}
    </Card>
  );
}

export function FamilyHomePage() {
  const { activeOrganization } = useAuth();
  const [recipients, setRecipients] = useState<MyRecipient[] | null>(null);
  const [selected, setSelected] = useState<MyRecipient | null>(null);
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [careSummary, setCareSummary] = useState<{
    shifts: FamilyShift[];
    observations: FamilyObservation[];
    incidents: FamilyIncident[];
  } | null>(null);
  const [loadingCareSummary, setLoadingCareSummary] = useState(false);
  const [careSummaryError, setCareSummaryError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingRecipients(true);
    listMyCareRecipients()
      .then((r) => {
        if (cancelled) return;
        setRecipients(r);
        const first = activeOrganization ? r.find((x) => x.organizationId === activeOrganization.id) ?? r[0] : r[0];
        setSelected(first ?? null);
      })
      .catch(() => !cancelled && setError("No pudimos cargar tus familiares autorizados."))
      .finally(() => !cancelled && setLoadingRecipients(false));
    return () => {
      cancelled = true;
    };
  }, [activeOrganization]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingTimeline(true);
    setError(null);
    getFamilyTimeline(selected.organizationId, selected.recipientId, { limit: 20 })
      .then((res) => !cancelled && setItems(res.items))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("Ya no tienes acceso a esta información. Si crees que esto es un error, contacta a la organización.");
        } else {
          setError("No pudimos cargar la actividad reciente.");
        }
      })
      .finally(() => !cancelled && setLoadingTimeline(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingCareSummary(true);
    setCareSummary(null);
    setCareSummaryError(false);
    Promise.all([
      listFamilyShifts(selected.organizationId, selected.recipientId),
      listFamilyObservations(selected.organizationId, selected.recipientId),
      listFamilyIncidents(selected.organizationId, selected.recipientId),
    ])
      .then(([shifts, observations, incidents]) => {
        if (!cancelled) setCareSummary({ shifts, observations, incidents });
      })
      .catch(() => {
        if (!cancelled) {
          setCareSummary(null);
          setCareSummaryError(true);
        }
      })
      .finally(() => !cancelled && setLoadingCareSummary(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (loadingRecipients) return <LoadingState label="Cargando..." />;

  if (!recipients || recipients.length === 0) {
    return <EmptyState title="Sin familiares vinculados todavía" description="Cuando una organización te autorice, aparecerá aquí." />;
  }

  return (
    <div style={{ padding: 16 }}>
      {recipients.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {recipients.map((r) => (
            <button
              key={r.recipientId}
              onClick={() => setSelected(r)}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 20,
                border: `1px solid ${selected?.recipientId === r.recipientId ? "var(--color-ink)" : "var(--color-border)"}`,
                background: selected?.recipientId === r.recipientId ? "var(--color-ink)" : "var(--color-surface)",
                color: selected?.recipientId === r.recipientId ? "#fff" : "var(--color-ink)",
                fontFamily: "var(--font-body)",
                cursor: "pointer",
              }}
            >
              {r.preferredName ?? r.firstName}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Avatar initials={initials(selected.firstName, selected.lastName)} color="var(--color-ink-tint)" />
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display)", color: "var(--color-ink)", margin: 0 }}>
              {selected.preferredName ?? selected.firstName} {selected.lastName}
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", margin: 0 }}>
              Actividad reciente
            </p>
          </div>
        </div>
      )}

      {loadingCareSummary && <LoadingState label="Cargando resumen de cuidado..." />}
      {!loadingCareSummary && careSummaryError && (
        <Card style={{ marginBottom: 24 }}>
          <p style={{ margin: 0, color: "var(--color-ink-soft)" }}>
            El resumen de cuidado no está disponible en este momento. La actividad reciente continúa disponible abajo.
          </p>
        </Card>
      )}
      {!loadingCareSummary && careSummary && <FamilyCareSummary {...careSummary} />}

      {loadingTimeline && <LoadingState label="Cargando actividad..." />}
      {!loadingTimeline && error && <ErrorState description={error} onRetry={() => setSelected((s) => (s ? { ...s } : s))} />}
      {!loadingTimeline && !error && items && items.length === 0 && (
        <EmptyState title="Sin actividad reciente" description="Aquí aparecerá lo que ocurra durante el cuidado." />
      )}
      {!loadingTimeline && !error && items && items.map((item) => <EventCard key={item.id} item={item} />)}

      {selected && (
        <Link
          to={`/messages?recipientId=${selected.recipientId}&organizationId=${selected.organizationId}`}
          style={{
            display: "block",
            textAlign: "center",
            marginTop: 20,
            padding: "12px",
            borderRadius: 10,
            background: "var(--color-ink-tint)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Enviar mensaje al equipo de cuidado
        </Link>
      )}
    </div>
  );
}

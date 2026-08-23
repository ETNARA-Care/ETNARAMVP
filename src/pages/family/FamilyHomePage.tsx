import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { listMyCareRecipients, getFamilyTimeline, type MyRecipient, type TimelineItem } from "../../api/familyRecipients";
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

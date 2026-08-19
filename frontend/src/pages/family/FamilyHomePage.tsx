import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getFamilyTimeline, type TimelineItem } from "../../api/familyRecipients";
import { ApiError } from "../../api/client";
import { LoadingState, EmptyState, ErrorState } from "../../components/UiStates";
import { Card } from "../../components/Primitives";
import {
  FamilyRecipientHero,
  FamilyRecipientPicker,
  FamilyTimelineCard,
  useFamilyRecipients,
  familyDisplayName,
} from "./familyShared";

function currentStatus(items: TimelineItem[]): { title: string; detail: string } {
  if (items.length === 0) {
    return {
      title: "Todavía no hay actualizaciones de hoy.",
      detail: "Cuando el equipo registre cuidados o novedades, aparecerán aquí.",
    };
  }
  const [latest] = items;
  return {
    title: `${latest.title}: ${latest.summary}`,
    detail: latest.caregiver.displayName ? `Última actualización por ${latest.caregiver.displayName}` : "Última actualización del equipo de cuidado",
  };
}

export function FamilyHomePage() {
  const { activeOrganization } = useAuth();
  const { recipients, selected, selectedId, setSelectedId, error: recipientError, loading: loadingRecipients } = useFamilyRecipients(
    activeOrganization?.id
  );
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingTimeline(true);
    setError(null);
    getFamilyTimeline(selected.organizationId, selected.recipientId, { limit: 12 })
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
  }, [selected, reloadKey]);

  if (loadingRecipients) return <LoadingState label="Cargando..." />;
  if (recipientError && !recipients) return <ErrorState description={recipientError} />;
  if (!recipients || recipients.length === 0) {
    return <EmptyState title="Sin familiares vinculados todavía" description="Cuando una organización te autorice, aparecerá aquí." />;
  }

  const status = currentStatus(items ?? []);

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: "0 auto", paddingBottom: 28 }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>Hoy</p>
        <h1 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--fs-display-lg)", color: "var(--color-ink)" }}>
          Sigue el cuidado en tiempo real
        </h1>
      </div>

      <FamilyRecipientPicker recipients={recipients} selectedId={selectedId} onSelect={setSelectedId} />

      {selected && (
        <FamilyRecipientHero recipient={selected} eyebrow="Tu ser querido" title={status.title} detail={status.detail} />
      )}

      {selected && (
        <Card style={{ marginBottom: 16, borderRadius: "var(--radius-lg)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>Qué pasó hoy</p>
              <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                {items?.length ? `${items.length} actualizaciones recientes de ${familyDisplayName(selected)}` : "Aún no hay registros del día."}
              </p>
            </div>
            <Link
              to={`/messages?recipientId=${selected.recipientId}&organizationId=${selected.organizationId}`}
              style={{
                textDecoration: "none",
                fontWeight: 700,
                color: "var(--color-ink)",
                background: "var(--color-ink-tint)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
              }}
            >
              Contactar al equipo
            </Link>
          </div>
        </Card>
      )}

      {loadingTimeline && <LoadingState label="Cargando actividad..." />}
      {!loadingTimeline && error && <ErrorState description={error} onRetry={() => setReloadKey((value) => value + 1)} />}
      {!loadingTimeline && !error && items && items.length === 0 && (
        <EmptyState title="Sin actividad reciente" description="Aquí aparecerá lo que ocurra durante el cuidado." />
      )}

      {!loadingTimeline && !error && items && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: "var(--fs-title)", color: "var(--color-ink)" }}>Timeline de hoy</h2>
            <Link to="/family/historial" style={{ fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
              Ver historial
            </Link>
          </div>
          {items.map((item) => (
            <FamilyTimelineCard key={item.id} item={item} />
          ))}
        </>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <Link
          to="/family/mensajes"
          style={{
            textDecoration: "none",
            color: "var(--color-ink)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 16px",
            fontWeight: 700,
          }}
        >
          Abrir mensajes
        </Link>
        <Link
          to="/notifications"
          style={{
            textDecoration: "none",
            color: "var(--color-ink)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 16px",
            fontWeight: 700,
          }}
        >
          Ver notificaciones
        </Link>
      </div>
    </div>
  );
}

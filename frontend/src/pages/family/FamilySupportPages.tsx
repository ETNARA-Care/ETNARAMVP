import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getFamilyTimeline, type TimelineItem } from "../../api/familyRecipients";
import { ApiError } from "../../api/client";
import { Card } from "../../components/Primitives";
import { LoadingState, EmptyState, ErrorState } from "../../components/UiStates";
import {
  FamilyRecipientHero,
  FamilyRecipientPicker,
  FamilyTimelineCard,
  formatFamilyDay,
  useFamilyRecipients,
} from "./familyShared";

function groupByDay(items: TimelineItem[]) {
  const groups = new Map<string, TimelineItem[]>();
  items.forEach((item) => {
    const key = new Date(item.occurredAt).toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return [...groups.entries()].map(([key, dayItems]) => ({ key, label: formatFamilyDay(dayItems[0].occurredAt), items: dayItems }));
}

export function FamilyHistoryPage() {
  const { activeOrganization } = useAuth();
  const { recipients, selected, selectedId, setSelectedId, error: recipientError, loading: loadingRecipients } = useFamilyRecipients(
    activeOrganization?.id
  );
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFamilyTimeline(selected.organizationId, selected.recipientId, { limit: 30 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setCursor(res.nextCursor);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("Ya no tienes acceso a este historial.");
        } else {
          setError("No pudimos cargar el historial.");
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function handleLoadMore() {
    if (!selected || !cursor) return;
    setLoading(true);
    try {
      const res = await getFamilyTimeline(selected.organizationId, selected.recipientId, { limit: 30, cursor });
      setItems((previous) => [...previous, ...res.items]);
      setCursor(res.nextCursor);
    } catch {
      setError("No pudimos cargar más actividad.");
    } finally {
      setLoading(false);
    }
  }

  const groups = useMemo(() => groupByDay(items), [items]);

  if (loadingRecipients) return <LoadingState label="Cargando..." />;
  if (recipientError && !recipients) return <ErrorState description={recipientError} />;
  if (!recipients || recipients.length === 0) {
    return <EmptyState title="Sin familiares vinculados todavía" description="Cuando una organización te autorice, aparecerá aquí." />;
  }

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: "0 auto", paddingBottom: 28 }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>Historial</p>
        <h1 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--fs-display-lg)", color: "var(--color-ink)" }}>
          Revisa el cuidado por día
        </h1>
      </div>

      <FamilyRecipientPicker recipients={recipients} selectedId={selectedId} onSelect={setSelectedId} />

      {selected && (
        <FamilyRecipientHero
          recipient={selected}
          eyebrow="Historial del cuidado"
          title="Todas las actualizaciones reales del timeline familiar."
          detail="Agrupadas por día para seguir la continuidad del cuidado."
        />
      )}

      {loading && items.length === 0 && <LoadingState label="Cargando historial..." />}
      {!loading && error && <ErrorState description={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState title="Sin actividad registrada" description="Cuando el equipo registre cuidados o novedades, aparecerán aquí." />
      )}

      {!error &&
        groups.map((group) => (
          <section key={group.key} style={{ marginBottom: 18 }}>
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)", textTransform: "capitalize" }}>{group.label}</p>
              <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                {group.items.length} {group.items.length === 1 ? "actualización" : "actualizaciones"}
              </p>
            </div>
            {group.items.map((item) => (
              <FamilyTimelineCard key={item.id} item={item} />
            ))}
          </section>
        ))}

      {cursor && !error && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          style={{
            width: "100%",
            minHeight: "var(--tap-min)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            fontWeight: 700,
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Cargando..." : "Cargar más historial"}
        </button>
      )}
    </div>
  );
}

export function FamilyProfilePage() {
  const { activeOrganization } = useAuth();
  const { recipients, selected, selectedId, setSelectedId, error, loading } = useFamilyRecipients(activeOrganization?.id);

  if (loading) return <LoadingState label="Cargando..." />;
  if (error && !recipients) return <ErrorState description={error} />;
  if (!recipients || recipients.length === 0) {
    return <EmptyState title="Sin familiares vinculados todavía" description="Cuando una organización te autorice, aparecerá aquí." />;
  }

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: "0 auto", paddingBottom: 28 }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>Perfil</p>
        <h1 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--fs-display-lg)", color: "var(--color-ink)" }}>
          Tus permisos y relación
        </h1>
      </div>

      <FamilyRecipientPicker recipients={recipients} selectedId={selectedId} onSelect={setSelectedId} />

      {selected && (
        <>
          <FamilyRecipientHero
            recipient={selected}
            eyebrow="Acceso autorizado"
            title="Este perfil usa únicamente permisos reales del backend."
            detail="No se muestran datos simulados de confianza o verificación."
          />
          <Card style={{ marginBottom: 12, borderRadius: "var(--radius-lg)" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>Relación</p>
            <p style={{ margin: "6px 0 0", color: "var(--color-ink-soft)" }}>{selected.relationshipType}</p>
          </Card>
          <Card style={{ marginBottom: 12, borderRadius: "var(--radius-lg)" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>Fotografías</p>
            <p style={{ margin: "6px 0 0", color: "var(--color-ink-soft)" }}>
              {selected.canViewPhotos ? "Puedes ver fotos compartidas cuando el equipo las publique." : "Tu acceso no incluye fotografías compartidas."}
            </p>
          </Card>
          <Card style={{ borderRadius: "var(--radius-lg)" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>Organización activa</p>
            <p style={{ margin: "6px 0 0", color: "var(--color-ink-soft)" }}>{activeOrganization?.name ?? "Sin organización activa"}</p>
          </Card>
        </>
      )}
    </div>
  );
}

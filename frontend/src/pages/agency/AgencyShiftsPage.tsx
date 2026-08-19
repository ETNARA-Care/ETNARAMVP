import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { listOrgShifts, type OrgShift } from "../../api/agency";
import { LoadingState, ErrorState } from "../../components/UiStates";
import { Card } from "../../components/Primitives";
import { Badge } from "../../components/Badge";
import { AlertIcon } from "../../components/icons";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shiftStatusBadge(status: string) {
  if (status === "scheduled") return <Badge tone="neutral" size="sm">Programado</Badge>;
  if (status === "active" || status === "in_progress") return <Badge tone="active" size="sm">En curso</Badge>;
  if (status === "completed") return <Badge tone="verified" size="sm">Completado</Badge>;
  if (status === "unassigned" || status === "open") return <Badge tone="warning" size="sm">Sin cubrir</Badge>;
  if (status === "cancelled") return <Badge tone="critical" size="sm">Cancelado</Badge>;
  return <Badge tone="neutral" size="sm">{status}</Badge>;
}

type TabKey = "upcoming" | "uncovered" | "all";

export function AgencyShiftsPage() {
  const { activeOrganization } = useAuth();
  const [shifts, setShifts] = useState<OrgShift[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("upcoming");

  const organizationId = activeOrganization?.id;

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);

    listOrgShifts(organizationId, { dateFrom: today })
      .then((res) => !cancelled && setShifts(res))
      .catch(() => !cancelled && setError("No pudimos cargar los turnos."))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [organizationId]);

  if (!organizationId) return <LoadingState />;
  if (loading) return <LoadingState label="Cargando turnos..." />;
  if (error) return <ErrorState description={error} />;

  const now = new Date().toISOString();
  const upcoming = (shifts ?? []).filter((s) => s.scheduled_start >= now && s.status !== "cancelled");
  const uncovered = (shifts ?? []).filter((s) => s.status === "unassigned" || s.status === "open");
  const all = shifts ?? [];

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "upcoming", label: "Próximos", count: upcoming.length },
    { key: "uncovered", label: "Sin cubrir", count: uncovered.length },
    { key: "all", label: "Todos", count: all.length },
  ];

  const displayed = tab === "upcoming" ? upcoming : tab === "uncovered" ? uncovered : all;

  return (
    <div style={{ padding: "var(--space-6) var(--space-6) var(--space-8)", maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--fs-display-lg)", marginBottom: "var(--space-2)" }}>Gestión de Turnos</h1>
      <p style={{ margin: "0 0 var(--space-5)", color: "var(--color-ink-soft)", fontSize: "var(--fs-body)" }}>
        {activeOrganization?.name}
      </p>

      {/* API capability notice */}
      <div
        style={{
          background: "var(--color-surface-muted)",
          border: "1px dashed var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-5)",
          fontSize: "var(--fs-caption)",
          color: "var(--color-ink-soft)",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <AlertIcon size={16} />
        <span>
          <strong>Capacidades actuales de la API:</strong> visualización de turnos ✓ · creación de turnos ✗ (pendiente POST /shifts) · asignación de cuidador ✗ (pendiente PATCH /shifts/:id/assign) · reasignación ✗ (pendiente).
          Las funciones marcadas con ✗ requieren nuevos endpoints en el backend.
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", borderBottom: "2px solid var(--color-border)", paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "3px solid var(--color-ink)" : "3px solid transparent",
              padding: "8px 16px",
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? "var(--color-ink)" : "var(--color-ink-soft)",
              cursor: "pointer",
              fontSize: "var(--fs-body)",
              marginBottom: -2,
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: t.key === "uncovered" ? "var(--color-warning-bg)" : "var(--color-ink-tint)",
                  color: t.key === "uncovered" ? "var(--color-warning)" : "var(--color-ink-soft)",
                  borderRadius: "var(--radius-full)",
                  padding: "2px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {displayed.length === 0 && (
        <div
          style={{
            background: "var(--color-surface-muted)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-8)",
            textAlign: "center",
            color: "var(--color-ink-soft)",
          }}
        >
          {tab === "uncovered" ? "No hay turnos sin cubrir. ¡Buena cobertura!" : "No hay turnos en esta sección."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {displayed.map((shift) => (
          <Card key={shift.id} style={{ padding: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-body)" }}>
                  {formatDateTime(shift.scheduled_start)}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                  Hasta {new Date(shift.scheduled_end).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  {shift.care_recipient_id ? ` · Persona: ${shift.care_recipient_id.slice(-8)}` : " · Sin persona asignada"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {shiftStatusBadge(shift.status)}
                {(shift.status === "unassigned" || shift.status === "open") && (
                  <span
                    title="Asignación de cuidador no disponible: requiere endpoint backend"
                    style={{
                      fontSize: "var(--fs-caption)",
                      color: "var(--color-ink-soft)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "4px 10px",
                      cursor: "not-allowed",
                      opacity: 0.6,
                    }}
                  >
                    Asignar (no disponible)
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

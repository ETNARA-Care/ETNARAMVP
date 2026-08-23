import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { listOrgWorkers, type OrgWorkerMembership } from "../../api/agency";
import { LoadingState, ErrorState } from "../../components/UiStates";
import { Card, Avatar } from "../../components/Primitives";
import { Badge } from "../../components/Badge";

const AVATAR_COLORS = ["#e7cf9f", "#bcd4c7", "#e3c2b8", "#c4d0e3", "#d4c4e3"];

function roleLabel(role: string) {
  if (role === "CAREGIVER") return "Cuidador/a";
  if (role === "NURSE") return "Enfermero/a";
  if (role === "SUPERVISOR") return "Supervisor/a";
  if (role === "COORDINATOR") return "Coordinador/a";
  return role;
}

export function AgencyTeamPage() {
  const { activeOrganization } = useAuth();
  const [workers, setWorkers] = useState<OrgWorkerMembership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const organizationId = activeOrganization?.id;

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setLoading(true);
    listOrgWorkers(organizationId)
      .then((res) => !cancelled && setWorkers(res))
      .catch(() => !cancelled && setError("No pudimos cargar el equipo."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [organizationId]);

  if (!organizationId) return <LoadingState />;
  if (loading) return <LoadingState label="Cargando equipo..." />;
  if (error) return <ErrorState description={error} />;

  const active = (workers ?? []).filter((w) => w.status === "active");
  const others = (workers ?? []).filter((w) => w.status !== "active");

  return (
    <div style={{ padding: "var(--space-6) var(--space-6) var(--space-8)", maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--fs-display-lg)", marginBottom: "var(--space-2)" }}>Equipo</h1>
      <p style={{ margin: "0 0 var(--space-5)", color: "var(--color-ink-soft)" }}>
        {activeOrganization?.name} · {active.length} miembro{active.length !== 1 ? "s" : ""} activo{active.length !== 1 ? "s" : ""}
      </p>

      {workers?.length === 0 && (
        <div style={{ background: "var(--color-surface-muted)", borderRadius: "var(--radius-md)", padding: "var(--space-8)", textAlign: "center", color: "var(--color-ink-soft)" }}>
          Todavía no hay miembros del equipo registrados.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {[...active, ...others].map((w, idx) => (
          <Card key={w.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4)" }}>
            <Avatar
              initials={w.worker_id.slice(0, 2).toUpperCase()}
              color={AVATAR_COLORS[idx % AVATAR_COLORS.length]}
              size={40}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-body)" }}>
                {roleLabel(w.internal_role)}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                ID: {w.worker_id.slice(-8)}
              </p>
            </div>
            {w.status === "active" ? (
              <Badge tone="verified" size="sm">Activo</Badge>
            ) : (
              <Badge tone="neutral" size="sm">{w.status}</Badge>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

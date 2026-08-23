import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { listOrgCareRecipients, type OrgCareRecipient } from "../../api/agency";
import { LoadingState, ErrorState } from "../../components/UiStates";
import { Card, Avatar } from "../../components/Primitives";
import { Badge } from "../../components/Badge";
import { ChevronRightIcon } from "../../components/icons";

const AVATAR_COLORS = ["#e7cf9f", "#bcd4c7", "#e3c2b8", "#c4d0e3", "#d4c4e3"];

function initials(r: OrgCareRecipient) {
  return ((r.preferred_name ?? r.first_name)[0] + r.last_name[0]).toUpperCase();
}

export function AgencyRecipientsPage() {
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const [recipients, setRecipients] = useState<OrgCareRecipient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const organizationId = activeOrganization?.id;

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setLoading(true);
    listOrgCareRecipients(organizationId)
      .then((res) => !cancelled && setRecipients(res))
      .catch(() => !cancelled && setError("No pudimos cargar las personas."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [organizationId]);

  if (!organizationId) return <LoadingState />;
  if (loading) return <LoadingState label="Cargando personas..." />;
  if (error) return <ErrorState description={error} />;

  const isResidential = activeOrganization?.type === "RESIDENTIAL_CARE_HOME";

  return (
    <div style={{ padding: "var(--space-6) var(--space-6) var(--space-8)", maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--fs-display-lg)", marginBottom: "var(--space-2)" }}>
        {isResidential ? "Residentes" : "Personas bajo cuidado"}
      </h1>
      <p style={{ margin: "0 0 var(--space-5)", color: "var(--color-ink-soft)" }}>
        {activeOrganization?.name} · {recipients?.length ?? 0} persona{recipients?.length !== 1 ? "s" : ""}
      </p>

      {recipients?.length === 0 && (
        <div style={{ background: "var(--color-surface-muted)", borderRadius: "var(--radius-md)", padding: "var(--space-8)", textAlign: "center", color: "var(--color-ink-soft)" }}>
          Todavía no hay personas registradas.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {(recipients ?? []).map((r, idx) => (
          <Card
            key={r.id}
            onClick={() => navigate(`/agency/personas/${r.id}`)}
            style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4)" }}
          >
            <Avatar initials={initials(r)} color={AVATAR_COLORS[idx % AVATAR_COLORS.length]} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-body)" }}>
                {r.preferred_name ?? r.first_name} {r.last_name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                {r.room_id ? `Habitación ${r.room_id}` : isResidential ? "Sin habitación" : "Visita a domicilio"}
                {r.date_of_birth ? ` · Nac. ${r.date_of_birth}` : ""}
              </p>
            </div>
            {r.status === "active" ? (
              <Badge tone="active" size="sm">Activo</Badge>
            ) : (
              <Badge tone="neutral" size="sm">{r.status}</Badge>
            )}
            <ChevronRightIcon size={16} color="var(--color-ink-soft)" />
          </Card>
        ))}
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { demoResidents } from "../../demoData/residents";
import { Card } from "../../components/Primitives";
import { Avatar } from "../../components/Primitives";
import { Badge } from "../../components/Badge";
import { AlertIcon, ChevronRightIcon } from "../../components/icons";
import { useOrgType } from "./orgTypeState";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        flex: "1 1 140px",
      }}
    >
      <p style={{ margin: 0, fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 600 }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>{label}</p>
    </div>
  );
}

export function AgencyDashboardPage() {
  const navigate = useNavigate();
  const { type, setType } = useOrgType();
  const isResidential = type === "RESIDENTIAL_CARE_HOME";

  const alerts = [
    "2 credenciales vencen esta semana",
    "1 turno requiere cobertura",
    "1 cambio de condición pendiente de revisión",
  ];

  return (
    <div style={{ padding: "var(--space-6) var(--space-6) var(--space-8)", maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--fs-display-lg)" }}>Buenos días</h1>
          <p style={{ margin: "2px 0 0", color: "var(--color-ink-soft)" }}>Hogar Serenidad Demo</p>
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--color-ink-soft)", display: "block", marginBottom: 4 }}>
            Tipo de organización
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--fs-caption)",
              background: "var(--color-surface)",
            }}
          >
            <option value="RESIDENTIAL_CARE_HOME">Residential Care Home</option>
            <option value="HOME_CARE_AGENCY">Home Care Agency</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", margin: "var(--space-5) 0" }}>
        <StatCard label={isResidential ? "Residentes activos" : "Pacientes activos"} value={3} />
        <StatCard label="Personal de turno" value={2} />
        <StatCard label={isResidential ? "Cobertura de turnos" : "Visitas de hoy"} value="100%" />
        <StatCard label="Profesionales verificados" value="92%" />
        <StatCard label="Credenciales por vencer" value={2} />
        <StatCard label="Incidentes abiertos" value={0} />
      </div>

      <h2 style={{ fontSize: "var(--fs-title)", marginBottom: "var(--space-3)" }}>Ahora</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
        {demoResidents.map((r) => (
          <Card
            key={r.id}
            onClick={() => navigate(`/agency/residentes/${r.id}`)}
            style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
          >
            <Avatar initials={r.avatarInitials} color={r.avatarColor} size={40} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{r.name}</p>
              <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                {isResidential ? r.room : "Visita a domicilio"}
              </p>
            </div>
            {r.status === "active_care" && <Badge tone="active" size="sm">Cuidado activo</Badge>}
            {r.status === "shift_completed" && <Badge tone="verified" size="sm">Completado</Badge>}
            {r.status === "upcoming" && <Badge tone="neutral" size="sm">{r.statusDetail.replace("Próxima visita ", "")}</Badge>}
            <ChevronRightIcon size={16} color="var(--color-ink-soft)" />
          </Card>
        ))}
      </div>

      <h2 style={{ fontSize: "var(--fs-title)", marginBottom: "var(--space-3)" }}>Alertas</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {alerts.map((a) => (
          <div
            key={a}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--color-warning-bg)",
              color: "var(--color-warning)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
            }}
          >
            <AlertIcon size={16} />
            <span style={{ fontSize: "var(--fs-body)" }}>{a}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "var(--space-6)" }}>
        <button
          onClick={() => navigate("/agency/cumplimiento")}
          style={{
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-5)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Ver Centro de Cumplimiento <ChevronRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}

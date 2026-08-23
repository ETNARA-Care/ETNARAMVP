import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { demoCaregivers } from "../../demoData/caregivers";
import { Avatar, Card, ScreenHeader } from "../../components/Primitives";
import { Badge } from "../../components/Badge";
import { ShieldIcon } from "../../components/icons";

type Filter = "all" | "verified" | "action_required" | "expiring";

export function AgencyComplianceCenterPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = demoCaregivers.filter((c) => {
    if (filter === "all") return true;
    if (filter === "verified") return c.verified;
    if (filter === "action_required") return c.credentials.some((cr) => cr.status === "action_required");
    if (filter === "expiring") return c.credentials.some((cr) => cr.status === "expiring");
    return true;
  });

  const verifiedPct = Math.round(
    (demoCaregivers.filter((c) => c.verified).length / demoCaregivers.length) * 100
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <ScreenHeader title="Confianza y Cumplimiento" onBack={() => navigate("/agency")} />
      <div style={{ padding: "0 var(--space-6)" }}>
        <Card style={{ marginBottom: "var(--space-5)", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 36, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-verified)" }}>
            {verifiedPct}%
          </p>
          <p style={{ margin: "4px 0 0", color: "var(--color-ink-soft)" }}>del personal completamente verificado</p>
        </Card>

        <div style={{ display: "flex", gap: 8, marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
          {([
            ["all", "Todos"],
            ["verified", "Verificados"],
            ["action_required", "Requiere acción"],
            ["expiring", "Próximos a vencer"],
          ] as [Filter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-full)",
                border: `1.5px solid ${filter === key ? "var(--color-ink)" : "var(--color-border)"}`,
                background: filter === key ? "var(--color-ink)" : "var(--color-surface)",
                color: filter === key ? "white" : "var(--color-ink)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {filtered.map((c) => {
            const expiring = c.credentials.find((cr) => cr.status === "expiring");
            const actionRequired = c.credentials.some((cr) => cr.status === "action_required");
            return (
              <Card
                key={c.id}
                onClick={() => navigate(`/agency/cuidadores/${c.id}`)}
                style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
              >
                <Avatar initials={c.avatarInitials} color={c.avatarColor} size={40} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{c.name}</p>
                  {expiring && (
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-warning)" }}>
                      CPR vence en 12 días
                    </p>
                  )}
                </div>
                {c.verified && !expiring && (
                  <Badge tone="verified" size="sm" icon={<ShieldIcon size={12} />}>Verified</Badge>
                )}
                {expiring && <Badge tone="warning" size="sm">Expiring</Badge>}
                {actionRequired && <Badge tone="critical" size="sm">Action Required</Badge>}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { demoResidents } from "../../demoData/residents";
import { getCaregiverById } from "../../demoData/caregivers";
import { Avatar, Card, ScreenHeader } from "../../components/Primitives";
import { Badge } from "../../components/Badge";
import { ShieldIcon, CheckIcon, ChevronRightIcon } from "../../components/icons";

export function FamilyTrustCenterPage() {
  const navigate = useNavigate();
  const resident = demoResidents[0];
  const caregiver = resident.currentCaregiverId ? getCaregiverById(resident.currentCaregiverId) : undefined;
  if (!caregiver) return null;

  return (
    <div>
      <ScreenHeader title="Centro de Confianza" />
      <div style={{ padding: "0 var(--space-5)" }}>
        <Card
          onClick={() => navigate(`/family/cuidador/${caregiver.id}`)}
          style={{ textAlign: "center", marginBottom: "var(--space-5)" }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-3)" }}>
            <Avatar initials={caregiver.avatarInitials} color={caregiver.avatarColor} size={64} />
          </div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-title)" }}>{caregiver.name}</p>
          <p style={{ margin: "2px 0 var(--space-3)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            Cuidadora
          </p>
          <Badge tone="verified" icon={<ShieldIcon size={16} />}>
            Profesional Verificada
          </Badge>
          <p style={{ margin: "var(--space-3) 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            Verificación revisada por la plataforma
          </p>
        </Card>

        <p style={{ fontWeight: 600, fontSize: "var(--fs-caption)", marginBottom: "var(--space-2)" }}>
          Requisitos verificados
        </p>
        <Card style={{ marginBottom: "var(--space-4)" }}>
          {caregiver.credentials.map((c, i) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 0",
                borderTop: i > 0 ? "1px solid var(--color-border)" : "none",
              }}
            >
              <CheckIcon size={16} color="var(--color-verified)" />
              <span style={{ fontSize: "var(--fs-body)" }}>{c.label}</span>
            </div>
          ))}
        </Card>

        <p style={{ fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: "var(--space-4)" }}>
          Última revisión: {caregiver.lastReview}. La familia ve el estado resumido de cumplimiento — no
          se muestran documentos ni información privada del proceso de verificación.
        </p>

        <button
          onClick={() => navigate(`/family/cuidador/${caregiver.id}`)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            color: "var(--color-ink)",
            fontWeight: 600,
            padding: 0,
          }}
        >
          Ver perfil completo de {caregiver.name.split(" ")[0]} <ChevronRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}

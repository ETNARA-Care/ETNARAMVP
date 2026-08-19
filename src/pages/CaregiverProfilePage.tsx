import { useNavigate, useParams } from "react-router-dom";
import type { ReactElement } from "react";
import { getCaregiverById } from "../demoData/caregivers";
import { Avatar, Card, ScreenHeader } from "../components/Primitives";
import { Badge } from "../components/Badge";
import { ShieldIcon, CheckIcon, AlertIcon } from "../components/icons";
import type { CredentialStatus } from "../demoData/caregivers";

const statusIcon: Record<CredentialStatus, ReactElement> = {
  verified: <CheckIcon size={16} color="var(--color-verified)" />,
  expiring: <AlertIcon size={16} color="var(--color-warning)" />,
  action_required: <AlertIcon size={16} color="var(--color-critical)" />,
};

interface Props {
  backTo: string;
}

export function CaregiverProfilePage({ backTo }: Props) {
  const { caregiverId } = useParams();
  const navigate = useNavigate();
  const caregiver = caregiverId ? getCaregiverById(caregiverId) : undefined;

  if (!caregiver) {
    return (
      <div>
        <ScreenHeader title="Cuidador no encontrado" onBack={() => navigate(backTo)} />
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title={`Perfil de ${caregiver.name.split(" ")[0]}`} onBack={() => navigate(backTo)} />
      <div style={{ padding: "0 var(--space-5)" }}>
        <Card style={{ textAlign: "center", marginBottom: "var(--space-5)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-3)" }}>
            <Avatar initials={caregiver.avatarInitials} color={caregiver.avatarColor} size={72} />
          </div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-title)" }}>{caregiver.name}</p>
          <p style={{ margin: "2px 0 var(--space-3)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            {caregiver.role} · {caregiver.yearsExperience} años de experiencia
          </p>
          {caregiver.verified ? (
            <Badge tone="verified" icon={<ShieldIcon size={14} />}>Verified</Badge>
          ) : (
            <Badge tone="warning">Action Required</Badge>
          )}
        </Card>

        <p style={{ fontWeight: 600, fontSize: "var(--fs-caption)", marginBottom: "var(--space-2)" }}>Idiomas</p>
        <p style={{ marginTop: 0, marginBottom: "var(--space-4)" }}>{caregiver.languages.join(", ")}</p>

        <p style={{ fontWeight: 600, fontSize: "var(--fs-caption)", marginBottom: "var(--space-2)" }}>Sobre {caregiver.name.split(" ")[0]}</p>
        <p style={{ marginTop: 0, marginBottom: "var(--space-5)", color: "var(--color-ink-soft)" }}>{caregiver.bio}</p>

        <p style={{ fontWeight: 600, fontSize: "var(--fs-caption)", marginBottom: "var(--space-2)" }}>
          Estado de requisitos
        </p>
        <Card>
          {caregiver.credentials.map((c, i) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "8px 0",
                borderTop: i > 0 ? "1px solid var(--color-border)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {statusIcon[c.status]}
                <span style={{ fontSize: "var(--fs-body)" }}>{c.label}</span>
              </div>
              {c.detail && (
                <span style={{ fontSize: 12, color: "var(--color-warning)" }}>{c.detail}</span>
              )}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

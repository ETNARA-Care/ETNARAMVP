import { useNavigate } from "react-router-dom";
import { demoResidents } from "../../demoData/residents";
import { getCaregiverById } from "../../demoData/caregivers";
import { demoTimelineToday } from "../../demoData/timeline";
import { Avatar, Card } from "../../components/Primitives";
import { Badge } from "../../components/Badge";
import { Timeline } from "../../components/Timeline";
import { ShieldIcon, ChevronRightIcon } from "../../components/icons";

export function FamilyTodayPage() {
  const navigate = useNavigate();
  const resident = demoResidents[0]; // Carmen Rivera Demo -- the family's linked resident
  const caregiver = resident.currentCaregiverId
    ? getCaregiverById(resident.currentCaregiverId)
    : undefined;

  return (
    <div style={{ paddingBottom: "var(--space-8)" }}>
      {/* Header: responde en segundos "¿cómo está mi familiar?" */}
      <div style={{ padding: "var(--space-5) var(--space-5) var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Avatar initials={resident.avatarInitials} color={resident.avatarColor} size={52} />
          <div>
            <h1 style={{ fontSize: "var(--fs-display)" }}>{resident.name.split(" ")[0]} está bien</h1>
            <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
              Última actualización: {resident.lastUpdate}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 var(--space-5)" }}>
        {/* Tarjeta de cuidado activo */}
        {caregiver && (
          <Card style={{ marginBottom: "var(--space-6)" }}>
            <p
              style={{
                margin: "0 0 var(--space-2)",
                fontSize: "var(--fs-caption)",
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: "var(--color-verified)",
              }}
            >
              Cuidado activo
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <Avatar initials={caregiver.avatarInitials} color={caregiver.avatarColor} size={48} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{caregiver.name}</p>
                <Badge tone="verified" size="sm" icon={<ShieldIcon size={12} />}>
                  Profesional Verificada
                </Badge>
              </div>
            </div>
            <p style={{ margin: "var(--space-3) 0 var(--space-3)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
              Horario: 8:00 AM – 5:00 PM
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
                fontSize: "var(--fs-caption)",
                padding: 0,
              }}
            >
              Ver perfil <ChevronRightIcon size={14} />
            </button>
          </Card>
        )}

        <h2 style={{ fontSize: "var(--fs-title)", marginBottom: "var(--space-4)" }}>Hoy</h2>
        <Timeline events={demoTimelineToday} />
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getResidentById } from "../../demoData/residents";
import { getCaregiverById } from "../../demoData/caregivers";
import { demoFamilyMembers, demoTimelineToday } from "../../demoData/timeline";
import { Avatar, Card, ScreenHeader } from "../../components/Primitives";
import { Badge } from "../../components/Badge";
import { Timeline } from "../../components/Timeline";
import { ShieldIcon } from "../../components/icons";

const tabs = ["Resumen", "Plan de cuidado", "Familia", "Timeline", "Equipo", "Documentos"] as const;
type Tab = (typeof tabs)[number];

export function AgencyResidentProfilePage() {
  const { residentId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("Resumen");
  const resident = residentId ? getResidentById(residentId) : undefined;

  if (!resident) {
    return <ScreenHeader title="Residente no encontrado" onBack={() => navigate("/agency")} />;
  }

  const caregiver = resident.currentCaregiverId ? getCaregiverById(resident.currentCaregiverId) : undefined;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <ScreenHeader title={resident.name} onBack={() => navigate("/agency")} />
      <div style={{ padding: "0 var(--space-6)" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: "var(--space-5)", overflowX: "auto" }}>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-full)",
                border: "none",
                background: tab === t ? "var(--color-ink)" : "var(--color-surface-muted)",
                color: tab === t ? "white" : "var(--color-ink)",
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Resumen" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Card style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <Avatar initials={resident.avatarInitials} color={resident.avatarColor} size={56} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-title)" }}>{resident.name}</p>
                <p style={{ margin: "2px 0 0", color: "var(--color-ink-soft)", fontSize: "var(--fs-caption)" }}>
                  {resident.age} años · {resident.room}
                </p>
              </div>
            </Card>
            {caregiver && (
              <Card style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <Avatar initials={caregiver.avatarInitials} color={caregiver.avatarColor} size={40} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-caption)" }}>Cuidador actual</p>
                  <p style={{ margin: "2px 0 0" }}>{caregiver.name}</p>
                </div>
                <Badge tone="verified" size="sm" icon={<ShieldIcon size={12} />}>Verified</Badge>
              </Card>
            )}
            <Card>
              <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "var(--fs-caption)" }}>Contactos familiares</p>
              {demoFamilyMembers.map((f) => (
                <p key={f.id} style={{ margin: "4px 0", fontSize: "var(--fs-body)" }}>
                  {f.name} — {f.relationship}
                </p>
              ))}
            </Card>
            <Card>
              <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "var(--fs-caption)" }}>Observaciones abiertas</p>
              <p style={{ margin: 0, color: "var(--color-ink-soft)", fontSize: "var(--fs-body)" }}>
                Ninguna observación pendiente de revisión.
              </p>
            </Card>
          </div>
        )}

        {tab === "Plan de cuidado" && (
          <Card>
            <p style={{ margin: 0, fontWeight: 600, marginBottom: 8 }}>Rutinas y preferencias (demo)</p>
            <p style={{ margin: 0, color: "var(--color-ink-soft)" }}>
              Prefiere desayunar temprano. Movilidad asistida para caminatas. Le gusta la música y el dominó por las tardes.
            </p>
          </Card>
        )}

        {tab === "Familia" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {demoFamilyMembers.map((f) => (
              <Card key={f.id}>
                <p style={{ margin: 0, fontWeight: 600 }}>{f.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                  {f.relationship} · {f.canReceiveNotifications ? "Notificaciones activas" : "Sin notificaciones"}
                </p>
              </Card>
            ))}
          </div>
        )}

        {tab === "Timeline" && <Timeline events={demoTimelineToday} />}

        {tab === "Equipo" && caregiver && (
          <Card
            onClick={() => navigate(`/agency/cuidadores/${caregiver.id}`)}
            style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
          >
            <Avatar initials={caregiver.avatarInitials} color={caregiver.avatarColor} size={40} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{caregiver.name}</p>
              <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>{caregiver.role}</p>
            </div>
          </Card>
        )}

        {tab === "Documentos" && (
          <Card>
            <p style={{ margin: 0, color: "var(--color-ink-soft)" }}>
              Documentos del expediente (demo) — plan de cuidado firmado, consentimientos de fotografía.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

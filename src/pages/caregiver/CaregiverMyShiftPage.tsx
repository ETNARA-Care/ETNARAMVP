import { useNavigate } from "react-router-dom";
import { demoResidents } from "../../demoData/residents";
import { Avatar, Card, PrimaryButton, ScreenHeader } from "../../components/Primitives";
import { Badge } from "../../components/Badge";
import { useShift } from "./shiftState";

export function CaregiverMyShiftPage() {
  const navigate = useNavigate();
  const { stage, startCheckIn } = useShift();
  const resident = demoResidents[0];

  return (
    <div>
      <ScreenHeader title="Mi turno de hoy" />
      <div style={{ padding: "0 var(--space-5)" }}>
        <Card style={{ textAlign: "center", marginBottom: "var(--space-5)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-3)" }}>
            <Avatar initials={resident.avatarInitials} color={resident.avatarColor} size={64} />
          </div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--fs-title)" }}>{resident.name}</p>
          <p style={{ margin: "4px 0 var(--space-3)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            Calle Flamboyán 142, Bayamón (demo)
          </p>
          <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            Horario: 8:00 AM – 5:00 PM
          </p>

          {stage === "not_started" && (
            <PrimaryButton onClick={() => { startCheckIn(); navigate("/caregiver/check-in"); }}>
              Llegué
            </PrimaryButton>
          )}
          {stage === "checkin_pin" && (
            <>
              <Badge tone="warning">Verificando llegada</Badge>
              <div style={{ marginTop: "var(--space-3)" }}>
                <PrimaryButton onClick={() => navigate("/caregiver/check-in")}>Continuar</PrimaryButton>
              </div>
            </>
          )}
          {stage === "active" && (
            <>
              <Badge tone="active">Turno en curso</Badge>
              <div style={{ marginTop: "var(--space-3)" }}>
                <PrimaryButton onClick={() => navigate("/caregiver/turno-activo")}>Ir al turno activo</PrimaryButton>
              </div>
            </>
          )}
          {stage === "completed" && <Badge tone="verified">Turno completado</Badge>}
        </Card>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { Card, PrimaryButton, ScreenHeader } from "../../components/Primitives";

export function CaregiverMyShiftPage() {
  const navigate = useNavigate();

  return (
    <div>
      <ScreenHeader title="Mi turno de hoy" onBack={() => navigate("/caregiver")} />
      <div style={{ padding: "0 var(--space-5)" }}>
        <Card style={{ display: "grid", gap: "var(--space-3)" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>Esta vista quedó reemplazada por el flujo real.</p>
          <p style={{ margin: 0, color: "var(--color-ink-soft)" }}>
            El cuidador ahora entra por <code>/caregiver</code> y desde allí abre el workspace real del turno con check-in, cuidados, observaciones e incidentes conectados al backend.
          </p>
          <PrimaryButton onClick={() => navigate("/caregiver")}>Abrir inicio del cuidador</PrimaryButton>
        </Card>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { Card, PrimaryButton, ScreenHeader } from "../../components/Primitives";

export function CaregiverObservationPage() {
  const navigate = useNavigate();

  return (
    <div>
      <ScreenHeader title="Observaciones" onBack={() => navigate("/caregiver")} />
      <div style={{ padding: "0 var(--space-5)" }}>
        <Card style={{ display: "grid", gap: "var(--space-3)" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>Esta superficie quedó reemplazada.</p>
          <p style={{ margin: 0, color: "var(--color-ink-soft)" }}>
            El flujo real de observaciones vive en el workspace del turno y usa <code>CaregiverObservationFormPage</code> con API real.
          </p>
          <PrimaryButton onClick={() => navigate("/caregiver")}>Volver al inicio del cuidador</PrimaryButton>
        </Card>
      </div>
    </div>
  );
}

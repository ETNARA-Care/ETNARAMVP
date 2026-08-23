import { useNavigate } from "react-router-dom";
import { Card, ScreenHeader } from "../../components/Primitives";

export function FamilyTrustCenterPage() {
  const navigate = useNavigate();

  return (
    <div>
      <ScreenHeader title="Centro de Confianza" onBack={() => navigate("/family")} />
      <div style={{ padding: "0 var(--space-5)", display: "grid", gap: "var(--space-3)" }}>
        <Card>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)" }}>Disponible cuando exista backend real</p>
          <p style={{ margin: "8px 0 0", color: "var(--color-ink-soft)" }}>
            La experiencia familiar ya usa timeline, mensajes y permisos reales. La verificación resumida del cuidador seguirá pendiente hasta que el backend exponga ese dato.
          </p>
        </Card>
      </div>
    </div>
  );
}

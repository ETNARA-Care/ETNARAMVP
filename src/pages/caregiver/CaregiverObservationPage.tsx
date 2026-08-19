import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PrimaryButton, ScreenHeader } from "../../components/Primitives";

const options = [
  "Menor apetito",
  "Somnolencia",
  "Confusión",
  "Dolor",
  "Cambio de comportamiento",
  "Menor movilidad",
  "Cambio en uso del baño",
  "Estado emocional",
  "Otro",
];

export function CaregiverObservationPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div style={{ padding: "var(--space-8) var(--space-5)", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display)", marginBottom: 8 }}>
          Enviado
        </p>
        <p style={{ color: "var(--color-ink-soft)", marginBottom: "var(--space-6)" }}>
          El equipo de cuidado podrá darle seguimiento.
        </p>
        <PrimaryButton onClick={() => navigate("/caregiver/turno-activo")}>Volver al turno</PrimaryButton>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="¿Qué observaste?" onBack={() => navigate("/caregiver/turno-activo")} />
      <div style={{ padding: "0 var(--space-5)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "var(--space-5)" }}>
          {options.map((o) => (
            <button
              key={o}
              onClick={() => setSelected(o)}
              style={{
                textAlign: "left",
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                border: `1.5px solid ${selected === o ? "var(--color-warning)" : "var(--color-border)"}`,
                background: selected === o ? "var(--color-warning-bg)" : "var(--color-surface)",
                fontWeight: 600,
                minHeight: "var(--tap-min)",
              }}
            >
              {o}
            </button>
          ))}
        </div>

        <p style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>Añadir detalle</p>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
          placeholder="Describe brevemente lo que notaste…"
          style={{
            width: "100%",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            padding: "var(--space-3)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-body)",
            marginBottom: "var(--space-5)",
            resize: "none",
          }}
        />

        <PrimaryButton onClick={() => setSent(true)} disabled={!selected}>
          Enviar para revisión
        </PrimaryButton>
      </div>
    </div>
  );
}

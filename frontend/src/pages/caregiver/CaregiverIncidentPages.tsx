import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PrimaryButton, ScreenHeader } from "../../components/Primitives";
import { AlertIcon, CheckIcon } from "../../components/icons";
import { useShift } from "./shiftState";

export function CaregiverIncidentPage() {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div style={{ padding: "var(--space-8) var(--space-5)", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display)", marginBottom: 8 }}>
          Incidente reportado
        </p>
        <p style={{ color: "var(--color-ink-soft)", marginBottom: "var(--space-6)" }}>
          El supervisor y la familia fueron notificados.
        </p>
        <PrimaryButton onClick={() => navigate("/caregiver/turno-activo")}>Volver al turno</PrimaryButton>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Reportar incidente" onBack={() => navigate("/caregiver/turno-activo")} />
      <div style={{ padding: "0 var(--space-5)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--color-critical-bg)",
            color: "var(--color-critical)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-4)",
            marginBottom: "var(--space-5)",
          }}
        >
          <AlertIcon size={18} color="var(--color-critical)" />
          <span style={{ fontSize: "var(--fs-caption)", fontWeight: 600 }}>
            Esto notifica de inmediato al supervisor y a la familia.
          </span>
        </div>

        <p style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>¿Qué ocurrió?</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Describe el incidente con el mayor detalle posible…"
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

        <PrimaryButton tone="critical" onClick={() => setSent(true)} disabled={!description.trim()}>
          Enviar reporte de incidente
        </PrimaryButton>
      </div>
    </div>
  );
}

export function CaregiverShiftCompletePage() {
  const navigate = useNavigate();
  const { loggedEvents, reset } = useShift();

  return (
    <div style={{ padding: "var(--space-8) var(--space-5)", textAlign: "center" }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "var(--color-verified-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto var(--space-4)",
        }}
      >
        <CheckIcon size={28} color="var(--color-verified)" />
      </div>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display)", marginBottom: 4 }}>
        Turno completado
      </p>
      <p style={{ color: "var(--color-ink-soft)", marginBottom: "var(--space-6)" }}>
        La familia de Carmen ya puede verlo. Registraste {loggedEvents.length}{" "}
        {loggedEvents.length === 1 ? "evento" : "eventos"} durante el turno.
      </p>
      <PrimaryButton
        onClick={() => {
          reset();
          navigate("/caregiver");
        }}
      >
        Volver a Mi Turno
      </PrimaryButton>
    </div>
  );
}

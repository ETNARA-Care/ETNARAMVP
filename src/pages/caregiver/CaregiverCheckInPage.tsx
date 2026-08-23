import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "../../components/Primitives";
import { useShift } from "./shiftState";

const DEMO_PIN = "1234";

function KeypadButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 64,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        fontSize: 24,
        fontWeight: 600,
        color: "var(--color-ink)",
      }}
    >
      {children}
    </button>
  );
}

export function CaregiverCheckInPage() {
  const navigate = useNavigate();
  const { confirmPin } = useShift();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (pin.length !== 4) return;
    if (pin === DEMO_PIN) {
      setConfirmed(true);
      confirmPin();
      const t = setTimeout(() => navigate("/caregiver/turno-activo"), 900);
      return () => clearTimeout(t);
    } else {
      setError(true);
      const t = setTimeout(() => {
        setPin("");
        setError(false);
      }, 700);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (confirmed) {
    return (
      <div style={{ padding: "var(--space-8) var(--space-5)", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display)" }}>Check-in confirmado</p>
        <p style={{ color: "var(--color-ink-soft)" }}>Llevándote al turno activo…</p>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Verificar llegada" onBack={() => navigate("/caregiver")} />
      <div style={{ padding: "0 var(--space-5)" }}>
        <p style={{ textAlign: "center", marginBottom: "var(--space-5)" }}>
          Solicita el código de 4 dígitos a la familia
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: "var(--space-5)" }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 44,
                height: 52,
                borderRadius: "var(--radius-sm)",
                border: `2px solid ${error ? "var(--color-critical)" : "var(--color-border)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontFamily: "var(--font-mono)",
              }}
            >
              {pin[i] ? "•" : ""}
            </div>
          ))}
        </div>
        {error && (
          <p style={{ textAlign: "center", color: "var(--color-critical)", fontSize: "var(--fs-caption)" }}>
            Código incorrecto. Inténtalo de nuevo.
          </p>
        )}
        <p style={{ textAlign: "center", fontSize: 11, color: "var(--color-ink-soft)", marginBottom: "var(--space-4)" }}>
          (Demo — usa el código 1234)
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <KeypadButton key={d} onClick={() => pin.length < 4 && setPin(pin + d)}>
              {d}
            </KeypadButton>
          ))}
          <div />
          <KeypadButton onClick={() => pin.length < 4 && setPin(pin + "0")}>0</KeypadButton>
          <KeypadButton onClick={() => setPin(pin.slice(0, -1))}>⌫</KeypadButton>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PrimaryButton, ScreenHeader } from "../../components/Primitives";
import { useShift } from "./shiftState";

const mealTypes = ["Desayuno", "Almuerzo", "Cena", "Snack"];
const amounts = ["Poco", "Mitad", "Casi todo", "Todo"];

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-5)" }}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onSelect(o)}
          style={{
            padding: "10px 16px",
            borderRadius: "var(--radius-full)",
            border: `1.5px solid ${selected === o ? "var(--color-ink)" : "var(--color-border)"}`,
            background: selected === o ? "var(--color-ink)" : "var(--color-surface)",
            color: selected === o ? "white" : "var(--color-ink)",
            fontWeight: 600,
            minHeight: "var(--tap-min)",
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function CaregiverMealFormPage() {
  const navigate = useNavigate();
  const { logEvent } = useShift();
  const [type, setType] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    logEvent("Comida");
    setSaved(true);
    setTimeout(() => navigate("/caregiver/turno-activo"), 800);
  }

  if (saved) {
    return (
      <div style={{ padding: "var(--space-8) var(--space-5)", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display)" }}>Registrado</p>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Comida" onBack={() => navigate("/caregiver/turno-activo")} />
      <div style={{ padding: "0 var(--space-5)" }}>
        <p style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>Tipo</p>
        <ChipRow options={mealTypes} selected={type} onSelect={setType} />

        <p style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>Cantidad consumida</p>
        <ChipRow options={amounts} selected={amount} onSelect={setAmount} />

        <p style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>Nota (opcional)</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej. Comió bien."
          rows={3}
          style={{
            width: "100%",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            padding: "var(--space-3)",
            fontSize: "var(--fs-body)",
            fontFamily: "var(--font-body)",
            marginBottom: "var(--space-5)",
            resize: "none",
          }}
        />

        <PrimaryButton onClick={handleSave} disabled={!type || !amount}>
          Guardar
        </PrimaryButton>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { PrimaryButton, ScreenHeader } from "../../components/Primitives";
import { useShift } from "./shiftState";
import {
  MealIcon,
  HydrationIcon,
  BathIcon,
  ActivityIcon,
  MoodIcon,
  NoteIcon,
  CameraIcon,
  AlertIcon,
} from "../../components/icons";

const actions = [
  { key: "meal", label: "Comida", Icon: MealIcon, route: "/caregiver/registrar/comida" },
  { key: "hydration", label: "Agua", Icon: HydrationIcon, route: null },
  { key: "bath", label: "Baño", Icon: BathIcon, route: null },
  { key: "mobility", label: "Movilidad", Icon: ActivityIcon, route: null },
  { key: "activity", label: "Actividad", Icon: ActivityIcon, route: null },
  { key: "mood", label: "Estado de ánimo", Icon: MoodIcon, route: null },
  { key: "note", label: "Nota", Icon: NoteIcon, route: null },
  { key: "photo", label: "Foto", Icon: CameraIcon, route: null },
] as const;

export function CaregiverActiveShiftPage() {
  const navigate = useNavigate();
  const { loggedEvents, logEvent, finishShift } = useShift();

  function handleQuickLog(label: string) {
    logEvent(label);
  }

  return (
    <div style={{ paddingBottom: "var(--space-6)" }}>
      <ScreenHeader title="Turno activo" subtitle="Carmen Rivera Demo" />
      <div style={{ padding: "0 var(--space-5)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            marginBottom: "var(--space-5)",
          }}
        >
          {actions.map(({ key, label, Icon, route }) => {
            const done = loggedEvents.includes(label);
            return (
              <button
                key={key}
                onClick={() => (route ? navigate(route) : handleQuickLog(label))}
                style={{
                  aspectRatio: "1",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${done ? "var(--color-verified)" : "var(--color-border)"}`,
                  background: done ? "var(--color-verified-bg)" : "var(--color-surface)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: 4,
                }}
              >
                <Icon size={26} color={done ? "var(--color-verified)" : "var(--color-ink)"} />
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => navigate("/caregiver/observacion")}
          style={{
            width: "100%",
            minHeight: "var(--tap-min)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-warning)",
            background: "var(--color-warning-bg)",
            color: "var(--color-warning)",
            fontWeight: 600,
            marginBottom: "var(--space-3)",
          }}
        >
          Reportar cambio o preocupación
        </button>

        <button
          onClick={() => navigate("/caregiver/incidente")}
          style={{
            width: "100%",
            minHeight: "var(--tap-min)",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "var(--color-critical)",
            color: "white",
            fontWeight: 700,
            marginBottom: "var(--space-6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <AlertIcon size={18} color="white" /> Reportar incidente
        </button>

        <PrimaryButton
          onClick={() => {
            finishShift();
            navigate("/caregiver/turno-completado");
          }}
        >
          Finalizar turno
        </PrimaryButton>
      </div>
    </div>
  );
}

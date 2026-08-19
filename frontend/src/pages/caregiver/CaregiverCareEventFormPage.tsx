import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { createCareEvent, type CareEventTypeCode } from "../../api/careEvents";
import { ScreenHeader, PrimaryButton } from "../../components/Primitives";
import { ErrorState } from "../../components/UiStates";
import { ApiError } from "../../api/client";

const MEAL_TYPES = ["Desayuno", "Almuerzo", "Cena", "Snack"] as const;
const MEAL_AMOUNTS = ["Poco", "Mitad", "Casi todo", "Todo"] as const;
const HYDRATION_AMOUNTS = ["Rechazó", "Poco", "Medio vaso", "Vaso completo"] as const;
const TOILETING_RESULTS = ["Sin novedad", "Asistencia parcial", "Asistencia total", "Requirió cambio"] as const;
const MOBILITY_ACTIVITIES = ["No realizada", "Caminata corta", "Caminata 15 minutos", "Con asistencia", "Silla de ruedas"] as const;
const MOODS = ["Contento", "Tranquilo", "Triste", "Ansioso", "Confundido", "Irritable", "Somnoliento"] as const;

const TITLES: Record<string, string> = {
  MEAL: "Registrar comida",
  HYDRATION: "Registrar hidratación",
  TOILETING: "Registrar baño / aseo",
  MOBILITY: "Registrar movilidad",
  ACTIVITY: "Registrar actividad",
  MOOD: "Registrar estado de ánimo",
  NOTE: "Registrar nota",
};

const IMPLEMENTED: CareEventTypeCode[] = ["MEAL", "HYDRATION", "TOILETING", "MOBILITY", "ACTIVITY", "MOOD", "NOTE"];

function OptionButtons<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: "0 0 var(--space-4)" }}>
      <legend style={{ fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: 8 }}>
        {label}
      </legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={value === opt}
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-full)",
              border: value === opt ? "2px solid var(--color-ink)" : "1px solid var(--color-border)",
              background: value === opt ? "var(--color-ink-tint)" : "var(--color-surface)",
              fontWeight: value === opt ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function CaregiverCareEventFormPage() {
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const { shiftId, typeCode } = useParams<{ shiftId: string; typeCode: string }>();
  const [searchParams] = useSearchParams();
  const recipientId = searchParams.get("recipientId");
  const organizationId = activeOrganization?.id;

  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number] | null>(null);
  const [mealAmount, setMealAmount] = useState<(typeof MEAL_AMOUNTS)[number] | null>(null);
  const [hydrationAmount, setHydrationAmount] = useState<(typeof HYDRATION_AMOUNTS)[number] | null>(null);
  const [toiletingResult, setToiletingResult] = useState<(typeof TOILETING_RESULTS)[number] | null>(null);
  const [mobilityActivity, setMobilityActivity] = useState<(typeof MOBILITY_ACTIVITIES)[number] | null>(null);
  const [activityLabel, setActivityLabel] = useState("");
  const [activityDuration, setActivityDuration] = useState("");
  const [mood, setMood] = useState<(typeof MOODS)[number] | null>(null);
  const [noteText, setNoteText] = useState("");
  const [extraNote, setExtraNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const code = typeCode as CareEventTypeCode;
  const valid = IMPLEMENTED.includes(code);

  if (!organizationId || !shiftId) return null;
  if (!valid) {
    return <ErrorState description="Este tipo de registro no está disponible." />;
  }
  if (!recipientId) {
    return <ErrorState description="No pudimos identificar a la persona bajo cuidado para este registro." />;
  }

  function isReady(): boolean {
    switch (code) {
      case "MEAL":
        return Boolean(mealType && mealAmount);
      case "HYDRATION":
        return Boolean(hydrationAmount);
      case "TOILETING":
        return Boolean(toiletingResult);
      case "MOBILITY":
        return Boolean(mobilityActivity);
      case "ACTIVITY":
        return activityLabel.trim().length > 0;
      case "MOOD":
        return Boolean(mood);
      case "NOTE":
        return noteText.trim().length > 0;
      default:
        return false;
    }
  }

  function buildPayload(): { payload?: Record<string, unknown>; noteText?: string } {
    switch (code) {
      case "MEAL":
        return { payload: { mealType, amountConsumed: mealAmount } };
      case "HYDRATION":
        return { payload: { amount: hydrationAmount } };
      case "TOILETING":
        return { payload: { result: toiletingResult } };
      case "MOBILITY":
        return { payload: { activity: mobilityActivity } };
      case "ACTIVITY": {
        const duration = activityDuration.trim() ? Number(activityDuration) : undefined;
        return { payload: { label: activityLabel.trim(), ...(duration ? { durationMinutes: duration } : {}) } };
      }
      case "MOOD":
        return { payload: { mood }, ...(extraNote.trim() ? { noteText: extraNote.trim() } : {}) };
      case "NOTE":
        return { noteText: noteText.trim() };
      default:
        return {};
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isReady()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { payload, noteText: nt } = buildPayload();
      await createCareEvent(organizationId!, shiftId!, {
        typeCode: code,
        careRecipientId: recipientId!,
        payload,
        noteText: nt,
      });
      setSuccess(true);
      setTimeout(() => navigate(`/caregiver/shifts/${shiftId}`), 900);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === "NO_ACTIVE_VISIT") {
        setSubmitError("Debes iniciar la visita antes de registrar este cuidado.");
      } else if (err instanceof ApiError && err.status === 409 && err.code === "EVENT_TYPE_NOT_ENABLED") {
        setSubmitError("Este tipo de registro no está habilitado para tu organización.");
      } else if (err instanceof ApiError && err.status === 404) {
        setSubmitError("Este cuidado no corresponde a la persona asignada a tu turno actual.");
      } else {
        setSubmitError("No pudimos guardar este registro. Intenta de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
      <ScreenHeader title={TITLES[code]} onBack={() => navigate(`/caregiver/shifts/${shiftId}`)} />
      <form onSubmit={handleSubmit} style={{ padding: "0 var(--space-5)" }}>
        {submitError && (
          <p role="alert" style={{ color: "var(--color-critical)", fontSize: "var(--fs-body)", marginBottom: 16 }}>
            {submitError}
          </p>
        )}
        {success && (
          <p role="status" style={{ color: "var(--color-verified)", fontWeight: 600, marginBottom: 16 }}>
            Registrado correctamente.
          </p>
        )}

        {code === "MEAL" && (
          <>
            <OptionButtons options={MEAL_TYPES} value={mealType} onChange={setMealType} label="Tipo de comida" />
            <OptionButtons options={MEAL_AMOUNTS} value={mealAmount} onChange={setMealAmount} label="Cantidad consumida" />
          </>
        )}
        {code === "HYDRATION" && (
          <OptionButtons options={HYDRATION_AMOUNTS} value={hydrationAmount} onChange={setHydrationAmount} label="Cantidad de líquido" />
        )}
        {code === "TOILETING" && (
          <OptionButtons options={TOILETING_RESULTS} value={toiletingResult} onChange={setToiletingResult} label="Resultado" />
        )}
        {code === "MOBILITY" && (
          <OptionButtons options={MOBILITY_ACTIVITIES} value={mobilityActivity} onChange={setMobilityActivity} label="Actividad realizada" />
        )}
        {code === "ACTIVITY" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="activity-label" style={{ display: "block", fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: 6 }}>
                Descripción de la actividad
              </label>
              <input
                id="activity-label"
                value={activityLabel}
                onChange={(e) => setActivityLabel(e.target.value)}
                placeholder="Ej. Dominó, música, caminata en el jardín"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-border)" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="activity-duration" style={{ display: "block", fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: 6 }}>
                Duración en minutos (opcional)
              </label>
              <input
                id="activity-duration"
                type="number"
                min={1}
                value={activityDuration}
                onChange={(e) => setActivityDuration(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-border)" }}
              />
            </div>
          </>
        )}
        {code === "MOOD" && (
          <>
            <OptionButtons options={MOODS} value={mood} onChange={setMood} label="Estado de ánimo observado" />
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="mood-note" style={{ display: "block", fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: 6 }}>
                Nota adicional (opcional)
              </label>
              <textarea
                id="mood-note"
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-border)", fontFamily: "var(--font-body)" }}
              />
            </div>
          </>
        )}
        {code === "NOTE" && (
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="note-text" style={{ display: "block", fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: 6 }}>
              Nota
            </label>
            <textarea
              id="note-text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={5}
              maxLength={4000}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-border)", fontFamily: "var(--font-body)" }}
            />
          </div>
        )}

        <PrimaryButton disabled={!isReady() || submitting}>{submitting ? "Guardando..." : "Guardar registro"}</PrimaryButton>
      </form>
    </div>
  );
}

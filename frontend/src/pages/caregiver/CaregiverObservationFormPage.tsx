import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { createObservation, type ObservationCategory } from "../../api/observations";
import { ScreenHeader, PrimaryButton } from "../../components/Primitives";
import { ErrorState } from "../../components/UiStates";

const CATEGORIES: Array<{ code: ObservationCategory; label: string }> = [
  { code: "low_appetite", label: "Poco apetito" },
  { code: "drowsiness", label: "Somnolencia" },
  { code: "confusion", label: "Confusión" },
  { code: "pain", label: "Dolor" },
  { code: "behavior_change", label: "Cambio de comportamiento" },
  { code: "reduced_mobility", label: "Movilidad reducida" },
  { code: "elimination_change", label: "Cambio en eliminación" },
  { code: "emotional_state", label: "Estado emocional" },
  { code: "other", label: "Otro" },
];

export function CaregiverObservationFormPage() {
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const { shiftId } = useParams<{ shiftId: string }>();
  const [searchParams] = useSearchParams();
  const recipientId = searchParams.get("recipientId");
  const organizationId = activeOrganization?.id;

  const [category, setCategory] = useState<ObservationCategory | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!organizationId || !shiftId) return null;
  if (!recipientId) {
    return <ErrorState description="No pudimos identificar a la persona bajo cuidado para esta observación." />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!category) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createObservation(organizationId!, {
        careRecipientId: recipientId!,
        category,
        description: description.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate(`/caregiver/shifts/${shiftId}`), 900);
    } catch {
      setSubmitError("No pudimos guardar la observación. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
      <ScreenHeader
        title="Nueva observación"
        subtitle="Una señal a seguir en el tiempo — no requiere acción inmediata como un incidente."
        onBack={() => navigate(`/caregiver/shifts/${shiftId}`)}
      />
      <form onSubmit={handleSubmit} style={{ padding: "0 var(--space-5)" }}>
        {submitError && (
          <p role="alert" style={{ color: "var(--color-critical)", fontSize: "var(--fs-body)", marginBottom: 16 }}>
            {submitError}
          </p>
        )}
        {success && (
          <p role="status" style={{ color: "var(--color-verified)", fontWeight: 600, marginBottom: 16 }}>
            Observación registrada correctamente.
          </p>
        )}

        <fieldset style={{ border: "none", padding: 0, margin: "0 0 var(--space-4)" }}>
          <legend style={{ fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: 8 }}>
            Categoría
          </legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCategory(c.code)}
                aria-pressed={category === c.code}
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-full)",
                  border: category === c.code ? "2px solid var(--color-ink)" : "1px solid var(--color-border)",
                  background: category === c.code ? "var(--color-ink-tint)" : "var(--color-surface)",
                  fontWeight: category === c.code ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="observation-description" style={{ display: "block", fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: 6 }}>
            Descripción (opcional)
          </label>
          <textarea
            id="observation-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="Describe lo que notaste..."
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-border)", fontFamily: "var(--font-body)" }}
          />
        </div>

        <PrimaryButton disabled={!category || submitting}>{submitting ? "Guardando..." : "Guardar observación"}</PrimaryButton>
      </form>
    </div>
  );
}

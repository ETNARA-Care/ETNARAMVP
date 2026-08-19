import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { createIncident } from "../../api/incidents";
import { ScreenHeader, PrimaryButton } from "../../components/Primitives";
import { ErrorState } from "../../components/UiStates";

// Sugerencias de severidad para agilizar la captura -- el backend real
// guarda `severity` como texto libre (1-50 caracteres), no como un enum
// cerrado, así que estos chips solo rellenan el campo de texto; el
// cuidador puede escribir cualquier otro valor.
const SEVERITY_SUGGESTIONS = ["Leve", "Moderado", "Grave", "Crítico"];

export function CaregiverIncidentFormPage() {
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const { shiftId } = useParams<{ shiftId: string }>();
  const [searchParams] = useSearchParams();
  const recipientId = searchParams.get("recipientId");
  const organizationId = activeOrganization?.id;

  const [severity, setSeverity] = useState("");
  const [description, setDescription] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!organizationId || !shiftId) return null;
  if (!recipientId) {
    return <ErrorState description="No pudimos identificar a la persona bajo cuidado para este incidente." />;
  }

  const ready = severity.trim().length > 0 && description.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createIncident(organizationId!, {
        careRecipientId: recipientId!,
        severity: severity.trim(),
        description: description.trim(),
        actionsTaken: actionsTaken.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate(`/caregiver/shifts/${shiftId}`), 900);
    } catch {
      setSubmitError("No pudimos guardar el incidente. Si es una emergencia, contacta a tu supervisor de inmediato.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
      <ScreenHeader
        title="Reportar incidente"
        subtitle="Para eventos que requieren seguimiento formal. Si es una emergencia médica, llama primero a los servicios de emergencia."
        onBack={() => navigate(`/caregiver/shifts/${shiftId}`)}
      />
      <form onSubmit={handleSubmit} style={{ padding: "0 var(--space-5)" }}>
        <div
          style={{
            background: "var(--color-critical-bg)",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 20,
          }}
        >
          <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-critical)" }}>
            Este reporte queda en el expediente permanente de la persona bajo cuidado y será revisado por tu organización.
          </p>
        </div>

        {submitError && (
          <p role="alert" style={{ color: "var(--color-critical)", fontSize: "var(--fs-body)", marginBottom: 16 }}>
            {submitError}
          </p>
        )}
        {success && (
          <p role="status" style={{ color: "var(--color-verified)", fontWeight: 600, marginBottom: 16 }}>
            Incidente reportado correctamente.
          </p>
        )}

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="incident-severity" style={{ display: "block", fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: 6 }}>
            Severidad
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {SEVERITY_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                aria-pressed={severity === s}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-full)",
                  border: severity === s ? "2px solid var(--color-critical)" : "1px solid var(--color-border)",
                  background: severity === s ? "var(--color-critical-bg)" : "var(--color-surface)",
                  fontWeight: severity === s ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            id="incident-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            maxLength={50}
            placeholder="Escribe la severidad"
            required
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-border)" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="incident-description" style={{ display: "block", fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: 6 }}>
            Descripción de lo ocurrido
          </label>
          <textarea
            id="incident-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={4000}
            required
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-border)", fontFamily: "var(--font-body)" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="incident-actions" style={{ display: "block", fontWeight: 600, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginBottom: 6 }}>
            Acciones tomadas (opcional)
          </label>
          <textarea
            id="incident-actions"
            value={actionsTaken}
            onChange={(e) => setActionsTaken(e.target.value)}
            rows={3}
            maxLength={4000}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--color-border)", fontFamily: "var(--font-body)" }}
          />
        </div>

        <PrimaryButton disabled={!ready || submitting} tone="critical">
          {submitting ? "Guardando..." : "Reportar incidente"}
        </PrimaryButton>
      </form>
    </div>
  );
}

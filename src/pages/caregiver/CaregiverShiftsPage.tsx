import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { listOrgShifts, type OrgShift } from "../../api/agency";
import { checkIn, checkOut, getVisitVerification, type VisitVerificationSummary } from "../../api/verification";
import { LoadingState, EmptyState, ErrorState } from "../../components/UiStates";
import { Card } from "../../components/Primitives";
import { ApiError } from "../../api/client";

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const dateFmt = s.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const timeFmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `${dateFmt} · ${timeFmt(s)} – ${timeFmt(e)}` : `${timeFmt(s)} – ${timeFmt(e)}`;
}

function ShiftCard({ shift, organizationId }: { shift: OrgShift; organizationId: string }) {
  const [status, setStatus] = useState<VisitVerificationSummary["status"] | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVisitVerification(organizationId, shift.id)
      .then((res) => !cancelled && setStatus(res.status))
      .catch(() => !cancelled && setStatus("not_started"));
    return () => {
      cancelled = true;
    };
  }, [organizationId, shift.id]);

  async function handleCheckIn() {
    setLoadingAction(true);
    setActionError(null);
    try {
      await checkIn(organizationId, shift.id);
      setStatus("in_progress");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setActionError(
          err.code.startsWith("WORKER_NOT_ELIGIBLE")
            ? "No cumples los requisitos vigentes para iniciar este turno. Contacta a tu supervisor."
            : "Este turno no puede iniciarse en este momento."
        );
      } else {
        setActionError("No pudimos registrar tu llegada. Intenta de nuevo.");
      }
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleCheckOut() {
    setLoadingAction(true);
    setActionError(null);
    try {
      await checkOut(organizationId, shift.id);
      setStatus("completed");
    } catch {
      setActionError("No pudimos registrar tu salida. Intenta de nuevo.");
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-body)",
          color: "var(--color-ink)",
          margin: "0 0 4px",
          textTransform: "capitalize",
        }}
      >
        {formatRange(shift.scheduled_start, shift.scheduled_end)}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", margin: "0 0 12px" }}>
        Estado del turno: {shift.status}
        {shift.room_id && " · Residencial"}
      </p>

      {actionError && (
        <p
          role="alert"
          style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-critical)", margin: "0 0 8px" }}
        >
          {actionError}
        </p>
      )}

      {status === "not_started" && shift.status !== "cancelled" && (
        <button
          onClick={handleCheckIn}
          disabled={loadingAction}
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            background: "var(--color-verified)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            cursor: "pointer",
            opacity: loadingAction ? 0.6 : 1,
          }}
        >
          {loadingAction ? "Registrando..." : "Iniciar visita"}
        </button>
      )}
      {status === "in_progress" && (
        <button
          onClick={handleCheckOut}
          disabled={loadingAction}
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            background: "var(--color-warning)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            cursor: "pointer",
            opacity: loadingAction ? 0.6 : 1,
          }}
        >
          {loadingAction ? "Registrando..." : "Finalizar visita"}
        </button>
      )}
      {status === "completed" && (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-verified)", fontWeight: 600 }}>
          Visita completada
        </span>
      )}
      {shift.status === "cancelled" && (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
          Turno cancelado
        </span>
      )}

      <div style={{ marginTop: 12 }}>
        <Link
          to={`/caregiver/shifts/${shift.id}`}
          style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--color-ink)" }}
        >
          Ver detalle del turno →
        </Link>
      </div>
    </Card>
  );
}

export function CaregiverShiftsPage() {
  const { activeOrganization } = useAuth();
  const [shifts, setShifts] = useState<OrgShift[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const organizationId = activeOrganization?.id;

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    setLoading(true);
    setError(null);
    listOrgShifts(organizationId, { dateFrom: today })
      .then((res) => !cancelled && setShifts(res))
      .catch(() => !cancelled && setError("No pudimos cargar tus turnos."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (!organizationId) return <LoadingState />;
  if (loading) return <LoadingState label="Cargando tus turnos..." />;
  if (error) return <ErrorState description={error} />;
  if (!shifts || shifts.length === 0) {
    return <EmptyState title="Sin turnos asignados" description="Cuando tengas un turno asignado, aparecerá aquí." />;
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display)", color: "var(--color-ink)" }}>Mis turnos</h1>
      {shifts.map((s) => (
        <ShiftCard key={s.id} shift={s} organizationId={organizationId} />
      ))}
    </div>
  );
}

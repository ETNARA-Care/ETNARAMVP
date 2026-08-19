import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { listOrgShifts, type OrgShift } from "../../api/agency";
import { checkIn, checkOut, getVisitVerification, type VisitVerificationSummary } from "../../api/verification";
import { LoadingState, EmptyState, ErrorState } from "../../components/UiStates";
import { Card } from "../../components/Primitives";
import { Badge, type BadgeTone } from "../../components/Badge";
import { ApiError } from "../../api/client";

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const dateFmt = s.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const timeFmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `${dateFmt} · ${timeFmt(s)} – ${timeFmt(e)}` : `${timeFmt(s)} – ${timeFmt(e)}`;
}

function statusBadge(shiftStatus: string, visitStatus: VisitVerificationSummary["status"] | null): { label: string; tone: BadgeTone } {
  if (shiftStatus === "cancelled") return { label: "Cancelado", tone: "neutral" };
  if (visitStatus === "completed") return { label: "Completado", tone: "verified" };
  if (visitStatus === "in_progress") return { label: "En curso", tone: "active" };
  return { label: "Pendiente", tone: "warning" };
}

function shiftOrder(shift: OrgShift) {
  return new Date(shift.scheduled_start).getTime();
}

function ShiftCard({
  shift,
  organizationId,
  title,
  subtitle,
}: {
  shift: OrgShift;
  organizationId: string;
  title?: string;
  subtitle?: string;
}) {
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

  const badge = statusBadge(shift.status, status);
  const isHomeCare = !shift.room_id;

  return (
    <Card
      style={{
        marginBottom: "var(--space-4)",
        padding: "var(--space-5)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: "var(--space-3)" }}>
          {title && <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</p>}
          {subtitle && <p style={{ margin: "4px 0 0", fontSize: "var(--fs-body)", color: "var(--color-ink)" }}>{subtitle}</p>}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-title)",
            fontWeight: 600,
            color: "var(--color-ink)",
            margin: 0,
            textTransform: "capitalize",
          }}
        >
          {formatRange(shift.scheduled_start, shift.scheduled_end)}
        </p>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", margin: "0 0 var(--space-4)" }}>
        {isHomeCare ? "Visita a domicilio" : "Turno residencial"}
      </p>

      {actionError && (
        <p
          role="alert"
          style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-critical)", margin: "0 0 var(--space-3)" }}
        >
          {actionError}
        </p>
      )}

      {status === "not_started" && shift.status !== "cancelled" && (
        <button
          onClick={handleCheckIn}
          disabled={loadingAction}
          style={{
            width: "100%",
            minHeight: "var(--tap-min)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-body)",
            fontWeight: 700,
            background: "var(--color-verified)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-md)",
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
            width: "100%",
            minHeight: "var(--tap-min)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-body)",
            fontWeight: 700,
            background: "var(--color-warning)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-md)",
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

      <div style={{ marginTop: "var(--space-4)" }}>
        <Link
          to={`/caregiver/shifts/${shift.id}`}
          style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--color-ink)" }}
        >
          Abrir workspace →
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

  const orderedShifts = useMemo(() => [...(shifts ?? [])].sort((a, b) => shiftOrder(a) - shiftOrder(b)), [shifts]);
  const actionableShifts = orderedShifts.filter((shift) => !["completed", "cancelled"].includes(shift.status));
  const focusShift = actionableShifts[0] ?? orderedShifts[0] ?? null;
  const remainingAgenda = orderedShifts.filter((shift) => shift.id !== focusShift?.id);

  if (!organizationId) return <LoadingState />;
  if (loading) return <LoadingState label="Cargando tus turnos..." />;
  if (error) return <ErrorState description={error} />;
  if (!shifts || shifts.length === 0) {
    return <EmptyState title="Sin turnos asignados" description="Cuando tengas un turno asignado, aparecerá aquí." />;
  }

  return (
    <div style={{ padding: "var(--space-4)", maxWidth: 560, margin: "0 auto", paddingBottom: 32 }}>
      <div style={{ marginBottom: "var(--space-5)" }}>
        <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>Tu jornada</p>
        <h1 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--fs-display-lg)", color: "var(--color-ink)" }}>
          Empieza por el turno que importa ahora
        </h1>
      </div>

      {focusShift && (
        <ShiftCard
          shift={focusShift}
          organizationId={organizationId}
          title="Turno actual o próximo"
          subtitle="Abre el workspace, registra cuidados y mantén la visita al día."
        />
      )}

      {remainingAgenda.length > 0 && (
        <div style={{ marginTop: "var(--space-6)" }}>
          <div style={{ marginBottom: "var(--space-3)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--fs-title)", color: "var(--color-ink)" }}>Agenda completa</h2>
            <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
              Tus siguientes turnos quedan visibles, pero el foco principal es tu workspace operativo.
            </p>
          </div>
          {remainingAgenda.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} organizationId={organizationId} />
          ))}
        </div>
      )}
    </div>
  );
}

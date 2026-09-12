import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, UserRound, XCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import {
  cancelShift,
  getShift,
  listAssignments,
  listCareRecipients,
  listWorkers,
  recipientName,
  type Assignment,
  type CareRecipient,
  type Shift,
  type WorkerMembership,
} from "@/api/shifts";
import { Badge, Button, Card, EmptyState, ErrorState, Modal, PageHeader, Skeleton, StatusBadge, useToast } from "@/components/ui";

const responseLabels: Record<Assignment["response_status"], string> = {
  pending: "Respuesta pendiente",
  accepted: "Aceptado",
  rejected: "Rechazado",
};

function responseTone(status: Assignment["response_status"]): "warning" | "success" | "danger" {
  if (status === "accepted") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

export function AgencyShiftDetailPage() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const { show } = useToast();
  const organizationId = activeOrganization?.id;
  const [shift, setShift] = useState<Shift | null | undefined>(undefined);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [recipient, setRecipient] = useState<CareRecipient | null>(null);
  const [workers, setWorkers] = useState<WorkerMembership[]>([]);
  const [error, setError] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loadedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !shiftId || !token) return;
    setError(false);
    try {
      const [shiftRow, assignmentRows, recipientRows, workerRows] = await Promise.all([
        getShift(organizationId, shiftId, token),
        listAssignments(organizationId, shiftId, token),
        listCareRecipients(organizationId, token),
        listWorkers(organizationId, token),
      ]);
      setShift(shiftRow);
      setAssignments(assignmentRows);
      setRecipient(recipientRows.find((row) => row.id === shiftRow.care_recipient_id) ?? null);
      setWorkers(workerRows);
    } catch {
      setShift(null);
      setError(true);
    }
  }, [organizationId, shiftId]);

  useEffect(() => { void load(); }, [load]);

  const workerByMembership = useMemo(
    () => Object.fromEntries(workers.map((worker) => [worker.id, worker])),
    [workers],
  );

  async function confirmCancellation() {
    const token = getToken();
    if (!organizationId || !shiftId || !token) return;
    setCancelling(true);
    try {
      const cancelled = await cancelShift(organizationId, shiftId, token);
      setShift(cancelled);
      setConfirmCancel(false);
      show("Turno cancelado. El registro permanece en el historial.", "success");
    } catch (requestError) {
      const apiError = requestError as ApiError;
      show(apiError.code === "SHIFT_CANNOT_BE_CANCELLED"
        ? "Este turno ya comenzó, venció o no puede cancelarse."
        : "No pudimos cancelar el turno. Intenta nuevamente.", "danger");
      await load();
    } finally {
      setCancelling(false);
    }
  }

  if (shift === undefined) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-48" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!shift) return <ErrorState kind="not_found" />;

  const cancellable = (shift.status === "unassigned" || shift.status === "confirmed")
    && new Date(shift.scheduled_start).getTime() > loadedAt;
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => navigate("/agency/shifts")} className="self-start">Volver a turnos</Button>
      <PageHeader
        title={recipientName(recipient ?? undefined)}
        description="Detalle operacional del turno y sus respuestas."
        actions={<StatusBadge status={shift.status} />}
      />

      <Card>
        <div className="flex items-start gap-3">
          <CalendarClock size={22} className="text-[var(--color-text-muted)] mt-0.5" aria-hidden />
          <div>
            <p className="font-medium text-[var(--color-text-primary)]">
              {start.toLocaleDateString("es-PR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="text-[var(--text-body)] text-[var(--color-text-secondary)] mt-1">
              {start.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – {end.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)] mb-3">Respuestas de cuidadores</h2>
        {assignments.length === 0 ? (
          <EmptyState title="Aún no hay respuestas" description="Asigna una cuidadora desde la lista de turnos." />
        ) : (
          <div className="flex flex-col gap-2">
            {assignments.map((assignment) => {
              const worker = workerByMembership[assignment.organization_worker_membership_id];
              return (
                <Card key={assignment.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserRound size={20} className="text-[var(--color-text-muted)] shrink-0" aria-hidden />
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-text-primary)] truncate">{worker?.display_name || worker?.internal_role || "Cuidador"}</p>
                        {assignment.responded_at && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Respondió {new Date(assignment.responded_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}</p>}
                      </div>
                    </div>
                    <Badge tone={responseTone(assignment.response_status)}>{responseLabels[assignment.response_status]}</Badge>
                  </div>
                  {assignment.response_status === "rejected" && (
                    <div className="border-t border-[var(--color-border-subtle)] pt-3">
                      <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Motivo del rechazo</p>
                      <p className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1">{assignment.response_reason || "Sin motivo indicado"}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {cancellable && (
        <Card className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-medium text-[var(--color-text-primary)]">Cancelar este turno</p>
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Se retirará de la operación activa, pero conservará su historial.</p>
          </div>
          <Button variant="danger" icon={<XCircle size={18} />} onClick={() => setConfirmCancel(true)}>Cancelar turno</Button>
        </Card>
      )}

      <Modal
        open={confirmCancel}
        onClose={() => !cancelling && setConfirmCancel(false)}
        title="Confirmar cancelación"
        footer={<><Button variant="secondary" disabled={cancelling} onClick={() => setConfirmCancel(false)}>Volver</Button><Button variant="danger" loading={cancelling} onClick={() => void confirmCancellation()}>Sí, cancelar turno</Button></>}
      >
        <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">¿Deseas cancelar el turno de {recipientName(recipient ?? undefined)}? Esta acción conservará el registro para auditoría.</p>
      </Modal>
    </div>
  );
}

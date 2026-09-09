import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import {
  assignShift, createShift, listAssignments, listCareRecipients, listShifts, listWorkers, recipientName,
  type Assignment, type CareRecipient, type Shift, type WorkerMembership,
} from "@/api/shifts";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Radio, Select, Skeleton, StatusBadge, useToast } from "@/components/ui";

function localDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function initialTimes() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return { start: localDateTime(start), end: localDateTime(new Date(start.getTime() + 4 * 60 * 60_000)) };
}

function formatWindow(shift: Shift): string {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  return `${start.toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short" })} · ${start.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}`;
}

function requestMessage(error: unknown): string {
  const apiError = error as ApiError;
  if (apiError.status === 0) return "No hay conexión con el servidor.";
  if (apiError.code === "SCHEDULE_CONFLICT") return "La cuidadora ya tiene otro turno en ese horario.";
  if (apiError.code?.startsWith("WORKER_NOT_ELIGIBLE")) return "La cuidadora no cumple los requisitos para ser asignada.";
  if (apiError.code === "ASSIGNMENT_ALREADY_EXISTS") return "La cuidadora ya está asignada a este turno.";
  return "No pudimos guardar el turno. Intenta nuevamente.";
}

export function AgencyShiftsPage() {
  const { activeOrganization } = useAuth();
  const { show } = useToast();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [recipients, setRecipients] = useState<CareRecipient[]>([]);
  const [workers, setWorkers] = useState<WorkerMembership[]>([]);
  const [assignmentByShift, setAssignmentByShift] = useState<Record<string, Assignment | undefined>>({});
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<Shift | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [times, setTimes] = useState(initialTimes);
  const organizationId = activeOrganization?.id;

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try {
      const [shiftRows, recipientRows, workerRows] = await Promise.all([
        listShifts(organizationId, token), listCareRecipients(organizationId, token), listWorkers(organizationId, token),
      ]);
      const assignmentRows = await Promise.all(shiftRows.map(async (shift) => [shift.id, await listAssignments(organizationId, shift.id, token)] as const));
      setShifts(shiftRows);
      setRecipients(recipientRows);
      setWorkers(workerRows.filter((worker) => worker.status === "active"));
      setAssignmentByShift(Object.fromEntries(assignmentRows.map(([shiftId, assignments]) => [
        shiftId,
        assignments.find((assignment) => assignment.response_status === "accepted")
          ?? assignments.find((assignment) => assignment.response_status === "pending"),
      ])));
    } catch {
      setError(true);
      setShifts([]);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const recipientById = useMemo(() => Object.fromEntries(recipients.map((item) => [item.id, item])), [recipients]);
  const workerById = useMemo(() => Object.fromEntries(workers.map((item) => [item.id, item])), [workers]);
  const orderedShifts = useMemo(() => [...(shifts ?? [])].sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()), [shifts]);

  function openCreate() {
    setTimes(initialTimes());
    setRecipientId(recipients[0]?.id ?? "");
    setSelectedWorkerId(workers[0]?.id ?? "");
    setCreating(true);
  }

  async function saveNewShift() {
    const token = getToken();
    if (!organizationId || !token || !recipientId || !selectedWorkerId) return;
    if (new Date(times.start).getTime() >= new Date(times.end).getTime()) {
      show("La hora de salida debe ser posterior a la de entrada.", "danger");
      return;
    }
    setSaving(true);
    try {
      const shift = await createShift(organizationId, {
        careRecipientId: recipientId, scheduledStart: new Date(times.start).toISOString(), scheduledEnd: new Date(times.end).toISOString(),
      }, token);
      await assignShift(organizationId, shift.id, selectedWorkerId, token);
      setCreating(false);
      show(`Asignación enviada a ${workerById[selectedWorkerId]?.display_name ?? "la cuidadora"}.`, "success");
      await load();
    } catch (requestError) {
      show(requestMessage(requestError), "danger");
      await load();
    } finally { setSaving(false); }
  }

  async function confirmAssignment() {
    const token = getToken();
    if (!organizationId || !token || !assigning || !selectedWorkerId) return;
    setSaving(true);
    try {
      await assignShift(organizationId, assigning.id, selectedWorkerId, token);
      setAssigning(null);
      show(`Asignación enviada a ${workerById[selectedWorkerId]?.display_name ?? "la cuidadora"}.`, "success");
      await load();
    } catch (requestError) { show(requestMessage(requestError), "danger"); }
    finally { setSaving(false); }
  }

  if (shifts === null) return <div className="flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <PageHeader title="Turnos" description="Asignaciones reales de la organización." actions={<Button icon={<Plus size={18} />} onClick={openCreate}>Crear turno</Button>} />
      {orderedShifts.length === 0 ? (
        <EmptyState title="No hay turnos todavía" description="Crea el primer turno y asígnalo a una cuidadora." action={{ label: "Crear turno", onClick: openCreate }} />
      ) : (
        <div className="flex flex-col gap-2">
          {orderedShifts.map((shift) => {
            const assignment = assignmentByShift[shift.id];
            const assignee = assignment ? workerById[assignment.organization_worker_membership_id] : undefined;
            return (
              <Card key={shift.id} className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{recipientName(recipientById[shift.care_recipient_id ?? ""])}</p>
                  <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{formatWindow(shift)}</p>
                  {assignee && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Cuidadora: {assignee.display_name ?? assignee.internal_role}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={shift.status} />
                  {assignment?.response_status === "pending" && <Badge tone="warning">Esperando respuesta</Badge>}
                  {assignment?.response_status === "accepted" && <Badge tone="success">Aceptado</Badge>}
                  {shift.status === "unassigned" && !assignment && <Button size="md" onClick={() => { setAssigning(shift); setSelectedWorkerId(workers[0]?.id ?? ""); }}>Asignar cuidadora</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => !saving && setCreating(false)} title="Crear y asignar turno" footer={<><Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void saveNewShift()} disabled={saving || !recipientId || !selectedWorkerId}>{saving ? "Guardando..." : "Crear y asignar"}</Button></>}>
        <div className="flex flex-col gap-4">
          <Select label="Persona atendida" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required><option value="">Selecciona una persona</option>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipientName(recipient)}</option>)}</Select>
          <Select label="Cuidadora" value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(event.target.value)} required><option value="">Selecciona una cuidadora</option>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.display_name ?? worker.internal_role}</option>)}</Select>
          <Input label="Entrada" type="datetime-local" value={times.start} onChange={(event) => setTimes((current) => ({ ...current, start: event.target.value }))} required />
          <Input label="Salida" type="datetime-local" value={times.end} onChange={(event) => setTimes((current) => ({ ...current, end: event.target.value }))} required />
        </div>
      </Modal>

      <Modal open={!!assigning} onClose={() => !saving && setAssigning(null)} title="Asignar cuidadora" footer={<><Button variant="secondary" onClick={() => setAssigning(null)} disabled={saving}>Cancelar</Button><Button onClick={() => void confirmAssignment()} disabled={saving || !selectedWorkerId}>{saving ? "Asignando..." : "Confirmar asignación"}</Button></>}>
        <fieldset className="flex flex-col gap-3">
          <legend className="text-[var(--text-small)] text-[var(--color-text-secondary)] mb-1">Cuidadores disponibles</legend>
          {workers.map((worker) => <Radio key={worker.id} name="worker" label={worker.display_name ?? worker.internal_role} checked={selectedWorkerId === worker.id} onChange={() => setSelectedWorkerId(worker.id)} />)}
        </fieldset>
      </Modal>
    </div>
  );
}

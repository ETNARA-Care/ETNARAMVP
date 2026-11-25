import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, HeartHandshake } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { PRACTICE_STATUS_LABEL, practiceApi, type PracticeRequirement } from "@/api/practice";
import { createShift, listCareRecipients, listShifts, recipientName, type CareRecipient, type Shift } from "@/api/shifts";
import { SELF_DECLARATION_NOTICE, SELF_DECLARATION_STATEMENT, selfAssignMessage, selfAssignShift, type SelfAssignResult } from "@/features/practice/selfAssign";

/**
 * 160 (PR B): Turnos de «Mi práctica». El cuidador independiente crea sus turnos y se los asigna con «Asignármelo»
 * (un solo paso: asignar y aceptar, con la elegibilidad de siempre en el backend). Sin cobertura, SmartMatch ni
 * selección de personal: esas funciones son de agencia.
 */
function localDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function initialTimes() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return { start: localDateTime(start), end: localDateTime(new Date(start.getTime() + 4 * 60 * 60_000)) };
}
function formatWindow(shift: Pick<Shift, "scheduled_start" | "scheduled_end">): string {
  const start = new Date(shift.scheduled_start), end = new Date(shift.scheduled_end);
  const day = start.toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short" });
  const time = (d: Date) => d.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time(start)} – ${time(end)}`;
}
type BadgeTone = Parameters<typeof Badge>[0]["tone"];
const STATUS: Record<Shift["status"], { label: string; tone: BadgeTone }> = {
  unassigned: { label: "Sin asignar", tone: "warning" },
  confirmed: { label: "Asignado a ti", tone: "success" },
  in_progress: { label: "En curso", tone: "accent" },
  completed: { label: "Completado", tone: "neutral" },
  cancelled: { label: "Cancelado", tone: "danger" },
};

export function PracticeShiftsPage() {
  const { activeOrganization, activeWorkerProfile } = useAuth();
  const organizationId = activeOrganization?.id;
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [clients, setClients] = useState<CareRecipient[]>([]);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(searchParams.get("create") === "1");
  const [clientId, setClientId] = useState("");
  const [times, setTimes] = useState(initialTimes);
  const [assignToMe, setAssignToMe] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyShift, setBusyShift] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SelfAssignResult | null>(null);
  // 161: advertencia y confirmación expresa (auditada) cuando faltan o vencieron documentos de su práctica.
  const [confirming, setConfirming] = useState<{ shiftId: string; pending: PracticeRequirement[] } | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try {
      const [shiftRows, clientRows] = await Promise.all([listShifts(organizationId, token), listCareRecipients(organizationId, token)]);
      setShifts(shiftRows);
      setClients(clientRows);
    } catch {
      setError(true);
      setShifts([]);
    }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const upcoming = useMemo(() => (shifts ?? [])
    .filter((s) => s.status !== "cancelled" && new Date(s.scheduled_end).getTime() > Date.now() - 12 * 60 * 60_000)
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start)), [shifts]);

  async function report(result: SelfAssignResult, shiftId?: string) {
    setLastResult(result);
    if (result.kind === "confirmation_required" && shiftId && organizationId) {
      const token = getToken();
      const docs = token ? await practiceApi.documents(organizationId, token).catch(() => null) : null;
      setConfirmChecked(false);
      setConfirming({ shiftId, pending: (docs?.requirements ?? []).filter((r) => r.isMandatory && (r.status === "MISSING" || r.status === "EXPIRED")) });
      return;
    }
    toast.show(selfAssignMessage(result), result.kind === "assigned" ? "success" : result.kind === "error" ? "danger" : "warning");
  }

  async function assignMe(shiftId: string) {
    const token = getToken();
    if (!organizationId || !token) return;
    setBusyShift(shiftId);
    try { await report(await selfAssignShift(organizationId, shiftId, token), shiftId); await load(); } finally { setBusyShift(null); }
  }

  async function confirmAndAssign() {
    const token = getToken();
    if (!organizationId || !token || !confirming || !confirmChecked) return;
    setBusyShift(confirming.shiftId);
    try {
      const result = await selfAssignShift(organizationId, confirming.shiftId, token, { confirmSelfDeclaration: true });
      setConfirming(null);
      await report(result);
      await load();
    } finally { setBusyShift(null); }
  }

  async function save() {
    const token = getToken();
    const effectiveClient = clientId || clients[0]?.id || "";
    if (!organizationId || !token || !effectiveClient) return;
    if (new Date(times.start).getTime() >= new Date(times.end).getTime()) { toast.show("La salida debe ser después de la entrada.", "warning"); return; }
    setSaving(true);
    try {
      const shift = await createShift(organizationId, {
        careRecipientId: effectiveClient,
        scheduledStart: new Date(times.start).toISOString(),
        scheduledEnd: new Date(times.end).toISOString(),
        ...(activeWorkerProfile?.internalRole ? { requiredRole: activeWorkerProfile.internalRole } : {}),
      }, token);
      setCreating(false);
      if (searchParams.get("create")) setSearchParams({}, { replace: true });
      if (assignToMe) await report(await selfAssignShift(organizationId, shift.id, token), shift.id);
      else toast.show("Turno creado.", "success");
      await load();
    } catch {
      toast.show("No pudimos crear el turno.", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]" data-testid="practice-shifts">
      <PageHeader title="Mis turnos" description="Crea los turnos de tus clientes y asígnatelos. Al asignártelo queda confirmado en tu «Mi día»."
        actions={<Button icon={<CalendarPlus size={18} />} onClick={() => setCreating((v) => !v)} disabled={clients.length === 0}>Nuevo turno</Button>} />

      {clients.length === 0 && shifts !== null && !error && (
        <Card><p className="text-[var(--color-text-secondary)]">Primero registra un cliente en <Link className="underline" to="/agency/residents">Clientes</Link>.</p></Card>
      )}

      {creating && clients.length > 0 && (
        <Card className="flex flex-col gap-3" data-testid="practice-new-shift">
          <Select label="Cliente" value={clientId || clients[0]?.id || ""} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{recipientName(c)}</option>)}
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Entrada" type="datetime-local" value={times.start} onChange={(e) => setTimes((t) => ({ ...t, start: e.target.value }))} required />
            <Input label="Salida" type="datetime-local" value={times.end} onChange={(e) => setTimes((t) => ({ ...t, end: e.target.value }))} required />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-[var(--color-text-primary)]">
            <input type="checkbox" checked={assignToMe} onChange={(e) => setAssignToMe(e.target.checked)} data-testid="practice-assign-to-me" className="h-5 w-5" />
            Asignármelo al crearlo
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()} loading={saving}>Crear turno</Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {lastResult && lastResult.kind === "not_eligible" && (
        <Card data-testid="practice-eligibility-note" className="border-[var(--color-warning-700)]/40">
          <p className="font-medium text-[var(--color-text-primary)]">{selfAssignMessage(lastResult)}</p>
          <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-text-secondary)]">
            Los requisitos de tu práctica son tu responsabilidad. ETNARA Care no verifica ni certifica documentos.
          </p>
        </Card>
      )}

      {shifts === null ? <Skeleton className="h-40" /> : error ? <ErrorState kind="server" onRetry={() => void load()} /> : upcoming.length === 0 ? (
        <EmptyState title="Sin turnos próximos" description="Cuando crees un turno aparecerá aquí." />
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((shift) => {
            const status = STATUS[shift.status];
            return (
              <li key={shift.id}>
                <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-text-primary)]">{recipientName(clientById[shift.care_recipient_id ?? ""])}</p>
                    <p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">{formatWindow(shift)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {shift.status === "unassigned" && (
                      <Button size="sm" variant="secondary" icon={<HeartHandshake size={16} />} loading={busyShift === shift.id} onClick={() => void assignMe(shift.id)}>Asignármelo</Button>
                    )}
                    <Link to={`/agency/shifts/${shift.id}`} className="text-[length:var(--text-small)] underline text-[var(--color-text-secondary)]">Detalle</Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={confirming !== null} onClose={() => busyShift === null && setConfirming(null)} sheetOnMobile title="Documentos pendientes"
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busyShift !== null} onClick={() => setConfirming(null)}>Volver</Button>
          <Button disabled={!confirmChecked} loading={busyShift !== null} data-testid="practice-confirm-assign" onClick={() => void confirmAndAssign()}>Confirmar y asignármelo</Button>
        </div>}>
        <div className="flex flex-col gap-3" data-testid="practice-self-declaration">
          <p className="text-[var(--color-text-primary)]">Según lo que registraste, a tu práctica le falta o se le venció:</p>
          <ul className="list-disc pl-5 text-[var(--color-text-secondary)]">{(confirming?.pending.length ? confirming.pending : [{ credentialTypeCode: "?", name: "Requisitos de tu práctica", status: "MISSING" } as PracticeRequirement]).map((r) => (
            <li key={r.credentialTypeCode}>{r.name}: {PRACTICE_STATUS_LABEL[r.status]}</li>))}</ul>
          <label className="flex min-h-11 items-start gap-2 text-[var(--color-text-primary)]">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} data-testid="practice-self-declaration-check" />
            {SELF_DECLARATION_STATEMENT}
          </label>
          <p className="text-[length:var(--text-small)] text-[var(--color-text-muted)]">{SELF_DECLARATION_NOTICE} Tu confirmación queda registrada.</p>
          <p className="text-[length:var(--text-small)]"><Link className="underline" to="/agency/documents">Ir a «Mis documentos»</Link></p>
        </div>
      </Modal>
    </div>
  );
}

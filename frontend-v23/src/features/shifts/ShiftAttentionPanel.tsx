import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, History } from "lucide-react";
import type { ApiError } from "@/api/client";
import { getToken } from "@/auth/token";
import {
  CLOSURE_OUTCOME_LABELS,
  CLOSURE_REASON_LABELS,
  CORRECTION_REASON_MIN,
  closeShiftWithoutService,
  closureNoteMin,
  getShiftAttention,
  recordOmittedVisitCorrection,
  shiftClosureErrorMessage,
  type ClosureReason,
  type ShiftAttention,
} from "@/api/shiftClosures";
import { Button, Card, Modal, Textarea, useToast } from "@/components/ui";

const when = (v: string) => new Date(v).toLocaleString("es-PR", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Big, thumb-sized choice row (iPhone). */
function Choice({ name, checked, onChange, label, testId }: { name: string; checked: boolean; onChange: () => void; label: string; testId?: string }) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-[var(--text-body)] ${checked ? "border-[var(--color-navy-800)] bg-[var(--color-ivory-100)]" : "border-[var(--color-border)]"}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-5 w-5 shrink-0 accent-[var(--color-navy-800)]" data-testid={testId} />
      <span>{label}</span>
    </label>
  );
}

/**
 * 154 — What the agency can legitimately do with a shift that ended without service. Shown to
 * administrators and supervisors only (the server decides; caregivers get 403).
 *  - «Cerrar como no cubierto» / «Cerrar: servicio no prestado»: reason + mandatory note. The
 *    shift and its history stay intact; it never counts as a service and is never billed.
 *  - «El servicio sí ocurrió»: exceptional, audited correction — entry and exit recorded as the
 *    agency's correction at today's time (never the visit time); the real hours are entered later
 *    in Horas, with a justification.
 * The operations center alert disappears only after one of these really happened.
 */
export function ShiftAttentionPanel({ organizationId, shiftId, onChanged }: { organizationId: string; shiftId: string; onChanged: () => void }) {
  const { show } = useToast();
  const [data, setData] = useState<ShiftAttention | null>(null);
  const [mode, setMode] = useState<"close" | "correct" | null>(null);
  const [reason, setReason] = useState<ClosureReason | null>(null);
  const [note, setNote] = useState("");
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try { setData(await getShiftAttention(organizationId, shiftId, token)); } catch { setData(null); }
  }, [organizationId, shiftId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount, as the other panels
  useEffect(() => { void load(); }, [load]);

  if (!data) return null;
  const pending = data.canClose || data.canCorrectOmittedVisit;
  if (!data.closure && !pending) return null;

  function open(next: "close" | "correct") {
    setMode(next); setReason(null); setNote(""); setFormError(null);
    const candidates = data!.acceptedCaregivers.filter((c) => !c.checkedIn);
    setMembershipId(candidates.length === 1 ? candidates[0].membershipId : null);
  }

  const min = mode === "correct" ? CORRECTION_REASON_MIN : closureNoteMin(reason);
  const trimmed = note.trim().length;
  const ready = mode === "close" ? Boolean(reason) && trimmed >= min : Boolean(membershipId) && trimmed >= min;

  async function submit() {
    const token = getToken();
    if (!token || !ready) return;
    setSaving(true); setFormError(null);
    try {
      if (mode === "close") {
        await closeShiftWithoutService(organizationId, shiftId, { reasonCode: reason!, note: note.trim() }, token);
        show("Turno cerrado. Queda en el historial con el motivo y la nota.", "success");
      } else {
        await recordOmittedVisitCorrection(organizationId, shiftId, { organizationWorkerMembershipId: membershipId!, reason: note.trim() }, token);
        show("Corrección registrada. Indica las horas reales en Horas para poder aprobarlas.", "success");
      }
      setMode(null);
      await load();
      onChanged();
    } catch (error) {
      setFormError(shiftClosureErrorMessage((error as ApiError).code));
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (data.closure) {
    const c = data.closure;
    return (
      <Card data-testid="shift-closure" aria-label="Cierre del turno">
        <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]"><History size={20} aria-hidden /> {CLOSURE_OUTCOME_LABELS[c.outcome]}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Motivo</dt><dd className="mt-1 text-[var(--text-small)]">{CLOSURE_REASON_LABELS[c.reasonCode]}</dd></div>
          <div><dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Cerrado por</dt><dd className="mt-1 break-words text-[var(--text-small)]">{c.closedByEmail ?? "—"} · {when(c.closedAt)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Nota de cierre</dt><dd className="mt-1 whitespace-pre-wrap break-words text-[var(--text-small)]">{c.note}</dd></div>
        </dl>
        <p className="mt-3 text-[var(--text-caption)] text-[var(--color-text-muted)]">No cuenta como servicio prestado ni se factura. El turno y su historial se conservan.</p>
        {data.closureContradicted && (
          <p className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-100,#fff7e6)] p-3 text-[var(--text-small)] text-[var(--color-text-primary)]" data-testid="closure-contradicted">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden /> Después del cierre llegó un registro de entrada real (por ejemplo, sin conexión). Revisa las horas de este turno antes de aprobarlas.
          </p>
        )}
      </Card>
    );
  }

  const closeLabel = data.outcome === "not_covered" ? "Cerrar como no cubierto" : "Cerrar: servicio no prestado";
  const candidates = data.acceptedCaregivers.filter((c) => !c.checkedIn);
  return (
    <Card data-testid="shift-attention" aria-label="Turno terminado sin servicio registrado">
      <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]"><AlertTriangle size={20} className="text-[var(--color-danger-700)]" aria-hidden />
        {data.outcome === "not_covered" ? "Este turno terminó sin cubrir" : "Este turno terminó sin registro de entrada"}</p>
      <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">
        Sigue en «Requiere atención» hasta que lo resuelvas. Cerrarlo no borra nada: queda en el historial con el motivo, la nota, quién y cuándo.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {data.canClose && <Button fullWidth variant="primary" icon={<CheckCircle2 size={18} />} onClick={() => open("close")} data-testid="open-close-shift">{closeLabel}</Button>}
        {data.canCorrectOmittedVisit && <Button fullWidth variant="secondary" icon={<ClipboardCheck size={18} />} onClick={() => open("correct")} data-testid="open-correct-visit">El servicio sí ocurrió</Button>}
      </div>

      <Modal
        open={mode !== null}
        sheetOnMobile
        onClose={() => !saving && setMode(null)}
        title={mode === "correct" ? "Corrección excepcional del registro" : closeLabel}
        footer={<>
          <Button variant="secondary" disabled={saving} onClick={() => setMode(null)}>Volver</Button>
          <Button variant="primary" loading={saving} disabled={!ready} onClick={() => void submit()} data-testid="confirm-shift-attention">
            {mode === "correct" ? "Registrar corrección" : "Confirmar cierre"}
          </Button>
        </>}
      >
        {mode === "close" && (
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[var(--text-small)] font-medium">Motivo</legend>
              {data.allowedReasons.map((r) => (
                <Choice key={r} name="closure-reason" checked={reason === r} onChange={() => setReason(r)} label={CLOSURE_REASON_LABELS[r]} testId={`reason-${r}`} />
              ))}
            </fieldset>
            <Textarea label="Nota de cierre" required rows={4} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)}
              hint={`${reason === "other" ? "Explica el motivo" : "Describe lo ocurrido"} (mínimo ${min} caracteres).${trimmed < min ? ` ${trimmed}/${min}` : ""}`}
              data-testid="closure-note" />
            <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">No se registrará como servicio prestado ni se facturará.</p>
          </div>
        )}
        {mode === "correct" && (
          <div className="flex flex-col gap-4">
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
              Úsalo solo si la visita sí ocurrió y faltó registrar la entrada. Se guardarán la entrada y la salida como <strong>corrección de la agencia, con la hora de hoy</strong> (no la de la visita), con tu nombre y el motivo.
              Las horas reales se indican después en Horas, con justificación. Nada se factura sin esa aprobación.
            </p>
            {candidates.length > 1 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-[var(--text-small)] font-medium">Cuidador que prestó el servicio</legend>
                {candidates.map((c) => (
                  <Choice key={c.membershipId} name="correction-caregiver" checked={membershipId === c.membershipId} onChange={() => setMembershipId(c.membershipId)} label={c.name} />
                ))}
              </fieldset>
            )}
            {candidates.length === 1 && <p className="text-[var(--text-small)]">Cuidador: <strong>{candidates[0].name}</strong></p>}
            <Textarea label="Motivo de la corrección" required rows={4} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)}
              hint={`Cómo se confirmó la visita (mínimo ${min} caracteres).${trimmed < min ? ` ${trimmed}/${min}` : ""}`} data-testid="correction-reason" />
          </div>
        )}
        {formError && <p role="alert" className="mt-3 text-[var(--text-small)] text-[var(--color-danger-700)]">{formError}</p>}
      </Modal>
    </Card>
  );
}

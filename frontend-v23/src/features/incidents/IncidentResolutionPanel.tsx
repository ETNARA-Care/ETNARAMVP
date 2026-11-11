import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, MessageSquarePlus, PlayCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ApiError } from "@/api/client";
import { getToken } from "@/auth/token";
import {
  FOLLOW_UP_NOTE_MIN,
  addIncidentTimelineEntry,
  getIncidentResolutionRules,
  incidentErrorMessage,
  updateIncidentStatus,
  type Incident,
  type IncidentResolutionRules,
} from "@/api/incidents";
import { Button, Card, Modal, Textarea, useToast } from "@/components/ui";

function Requirement({ ok, children }: { ok: boolean; children: string }) {
  return (
    <li className="flex items-start gap-2 text-[var(--text-small)]">
      {ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--color-success-700)]" aria-hidden /> : <Circle size={18} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden />}
      <span className={ok ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}>{children}</span>
    </li>
  );
}

/**
 * 154 — Resolve an incident for real: the operations center alert disappears only when the
 * incident is resolved. Who resolved it and when are kept; resolved is final; the story is never
 * edited or deleted. Serious incidents need documented follow-up and a closer the agency
 * authorized (ORGANIZATION_ADMIN, or a supervisor authorized in Configuración). The server
 * enforces every rule; the panel only explains what is missing (nothing is hidden).
 */
export function IncidentResolutionPanel({ organizationId, incident, onChanged }: { organizationId: string; incident: Incident; onChanged: () => void }) {
  const { show } = useToast();
  const [rules, setRules] = useState<IncidentResolutionRules | null>(null);
  const [mode, setMode] = useState<"note" | "resolve" | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    // Caregivers get 403 here: they never resolve incidents, so the panel stays hidden.
    try { setRules(await getIncidentResolutionRules(organizationId, incident.id, token)); } catch { setRules(null); }
  }, [organizationId, incident.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount, as the other panels
  useEffect(() => { void load(); }, [load, incident.status]);

  if (!rules) return null;
  const resolved = incident.status === "resolved";
  if (resolved) {
    return (
      <Card data-testid="incident-resolved">
        <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]"><ShieldCheck size={20} className="text-[var(--color-success-700)]" aria-hidden /> Incidente resuelto</p>
        <p className="mt-1 break-words text-[var(--text-small)] text-[var(--color-text-secondary)]">
          {rules.resolvedByEmail ? `Por ${rules.resolvedByEmail}` : "Resuelto antes del registro de responsable"}
          {incident.resolved_at ? ` · ${new Date(incident.resolved_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}` : ""}
        </p>
        <p className="mt-2 text-[var(--text-caption)] text-[var(--color-text-muted)]">Un incidente resuelto no se reabre ni se borra; se pueden seguir añadiendo notas.</p>
      </Card>
    );
  }

  const followUpOk = incident.status === "in_progress" && rules.hasDocumentedFollowUp;
  const blockers: string[] = [];
  if (rules.serious) {
    if (!rules.canCloseSerious) blockers.push("Solo una administradora o una supervisora autorizada por la agencia puede cerrarlo.");
    if (!followUpOk) blockers.push("Primero ponlo en seguimiento y documenta al menos una nota de seguimiento.");
  }
  const min = mode === "resolve" ? rules.minResolutionLength : FOLLOW_UP_NOTE_MIN;
  const trimmed = text.trim().length;

  function open(next: "note" | "resolve") { setMode(next); setText(""); setFormError(null); }

  async function startFollowUp() {
    const token = getToken(); if (!token) return;
    setSaving(true);
    try {
      await updateIncidentStatus(organizationId, incident.id, { status: "in_progress" }, token);
      show("Incidente en seguimiento.", "success");
      onChanged();
    } catch (error) { show(incidentErrorMessage((error as ApiError).code), "danger"); }
    finally { setSaving(false); }
  }

  async function submit() {
    const token = getToken(); if (!token || trimmed < min) return;
    setSaving(true); setFormError(null);
    try {
      if (mode === "note") {
        await addIncidentTimelineEntry(organizationId, incident.id, text.trim(), token);
        show("Nota de seguimiento añadida.", "success");
      } else {
        await updateIncidentStatus(organizationId, incident.id, { status: "resolved", resolution: text.trim() }, token);
        show("Incidente resuelto. Queda en el historial.", "success");
      }
      setMode(null);
      await load();
      onChanged();
    } catch (error) {
      setFormError(incidentErrorMessage((error as ApiError).code));
      await load();
    } finally { setSaving(false); }
  }

  return (
    <Card data-testid="incident-resolution">
      <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]">
        {rules.serious ? <ShieldAlert size={20} className="text-[var(--color-danger-700)]" aria-hidden /> : <ShieldCheck size={20} aria-hidden />}
        {rules.serious ? "Incidente grave: requiere revisión" : "Atender este incidente"}
      </p>
      <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">
        Sigue en «Requiere atención» hasta que se resuelva. Resolverlo guarda quién, cuándo y la resolución.
      </p>
      {rules.serious && (
        <ul className="mt-3 flex flex-col gap-1.5" data-testid="serious-requirements">
          <Requirement ok={incident.status === "in_progress"}>En seguimiento</Requirement>
          <Requirement ok={rules.hasDocumentedFollowUp}>Al menos una nota de seguimiento documentada</Requirement>
          <Requirement ok={rules.canCloseSerious}>Cierre por administradora o supervisora autorizada</Requirement>
        </ul>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {incident.status === "open" && <Button fullWidth variant="secondary" icon={<PlayCircle size={18} />} loading={saving && mode === null} onClick={() => void startFollowUp()} data-testid="start-follow-up">Iniciar seguimiento</Button>}
        <Button fullWidth variant="secondary" icon={<MessageSquarePlus size={18} />} onClick={() => open("note")} data-testid="add-follow-up-note">Añadir nota de seguimiento</Button>
        <Button fullWidth variant="primary" icon={<CheckCircle2 size={18} />} disabled={blockers.length > 0} onClick={() => open("resolve")} data-testid="open-resolve-incident">Resolver incidente</Button>
      </div>
      {blockers.length > 0 && <ul className="mt-2 flex flex-col gap-1">{blockers.map((b) => <li key={b} className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{b}</li>)}</ul>}

      <Modal
        open={mode !== null}
        sheetOnMobile
        onClose={() => !saving && setMode(null)}
        title={mode === "resolve" ? "Resolver incidente" : "Nota de seguimiento"}
        footer={<>
          <Button variant="secondary" disabled={saving} onClick={() => setMode(null)}>Volver</Button>
          <Button variant="primary" loading={saving} disabled={trimmed < min} onClick={() => void submit()} data-testid="confirm-incident-action">
            {mode === "resolve" ? "Confirmar resolución" : "Guardar nota"}
          </Button>
        </>}
      >
        <Textarea
          label={mode === "resolve" ? "Resolución" : "Seguimiento"}
          required rows={5} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)}
          hint={mode === "resolve"
            ? `Qué se hizo y cómo quedó la persona (mínimo ${min} caracteres).${trimmed < min ? ` ${trimmed}/${min}` : ""}`
            : `Qué se revisó o a quién se informó (mínimo ${min} caracteres).${trimmed < min ? ` ${trimmed}/${min}` : ""}`}
          data-testid="incident-action-text"
        />
        {mode === "resolve" && <p className="mt-3 text-[var(--text-caption)] text-[var(--color-text-muted)]">Un incidente resuelto no se puede reabrir ni borrar.</p>}
        {formError && <p role="alert" className="mt-3 text-[var(--text-small)] text-[var(--color-danger-700)]">{formError}</p>}
      </Modal>
    </Card>
  );
}

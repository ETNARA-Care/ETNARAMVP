import { useCallback, useEffect, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import { FAMILY_SECTION_DEFAULTS, shiftReportsApi, type FamilySectionKey, type FamilySections, type ShiftReport } from "@/api/shiftReports";
import { Badge, Button, Card, Modal, Skeleton, Textarea, useToast } from "@/components/ui";
import { ShiftReportView } from "./ShiftReportView";
import { STATUS_LABEL, reportShortDate, reportTime } from "./reportFormat";

/** Agency view of a shift's report(s) (Informe de Turno F1+F2): read, refresh a draft, return to the caregiver, approve. */
const FAMILY_LABEL: Record<FamilySectionKey, string> = {
  schedule: "Horarios del turno", meals: "Alimentación", hydration: "Hidratación", activities: "Actividades y acompañamiento",
  mobility: "Movilidad", observations: "Observaciones de la cuidadora", hygiene: "Higiene", mood: "Ánimo",
  incidents: "Incidentes", photos: "Fotos aprobadas",
};
const FAMILY_ORDER: FamilySectionKey[] = ["schedule", "meals", "hydration", "activities", "mobility", "observations", "hygiene", "mood", "incidents", "photos"];
const HISTORY_LABEL: Record<string, string> = {
  GENERATED: "Borrador generado", REGENERATED: "Borrador actualizado", APPROVED: "Aprobado", SUBMITTED: "Enviado a revisión",
  RETURNED: "Devuelto", OBSERVATION_ADDED: "Observación añadida", CORRECTED: "Corregido", PDF_DOWNLOADED: "PDF descargado",
};
function errorText(error: unknown) {
  const code = (error as ApiError)?.code;
  if (code === "SHIFT_REPORT_CHANGED") return "El borrador cambió mientras lo revisabas. Revísalo de nuevo antes de aprobar.";
  if (code === "SHIFT_REPORT_ALREADY_APPROVED") return "Este informe ya fue aprobado.";
  if (code === "SHIFT_REPORT_NOT_DRAFT") return "Solo se puede actualizar un borrador.";
  if (code === "SHIFT_REPORT_WINDOW_CLOSED") return "Pasaron las 24 horas de la cuidadora: ya no se puede devolver. Puedes aprobarlo.";
  if (code === "SHIFT_REPORT_NOT_SUBMITTED") return "Solo se puede devolver un informe enviado por la cuidadora.";
  if (code === "SHIFT_REPORT_SELF_APPROVAL") return "No puedes aprobar el informe de un turno que trabajaste tú. Otra persona autorizada debe aprobarlo.";
  if ((error as ApiError)?.status === 0) return "No hay conexión con el servidor.";
  return "No se pudo completar la acción. Intenta de nuevo.";
}

export function ShiftReportPanel({ organizationId, shiftId }: { organizationId: string; shiftId: string }) {
  const { show } = useToast();
  const [data, setData] = useState<{ reports: ShiftReport[]; openVisits: number } | null | "error" | "forbidden">(null);
  const [approving, setApproving] = useState<ShiftReport | null>(null);
  const [sections, setSections] = useState<FamilySections>(FAMILY_SECTION_DEFAULTS);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState<ShiftReport | null>(null);
  const [returnNote, setReturnNote] = useState("");

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try { const r = await shiftReportsApi.forShift(organizationId, shiftId, token); setData({ reports: r.reports, openVisits: r.openVisits }); }
    catch (e) { setData((e as ApiError)?.status === 403 ? "forbidden" : "error"); }
  }, [organizationId, shiftId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- same load-on-mount pattern as ShiftVisitPanel
  useEffect(() => { void load(); }, [load]);

  async function refresh(report: ShiftReport) {
    const token = getToken(); if (!token) return;
    setBusy(true);
    try { await shiftReportsApi.refresh(organizationId, report.id, token); show("Borrador actualizado con los registros del turno.", "success"); }
    catch (e) { show(errorText(e), "danger"); }
    finally { setBusy(false); await load(); }
  }
  async function approve() {
    const token = getToken(); if (!token || !approving) return;
    setBusy(true);
    try {
      await shiftReportsApi.approve(organizationId, approving.id, { expectedGeneratedAt: approving.generatedAt, familySections: sections, ...(summary.trim() ? { agencySummary: summary.trim() } : {}) }, token);
      show("Informe aprobado.", "success"); setApproving(null);
    } catch (e) { show(errorText(e), "danger"); }
    finally { setBusy(false); await load(); }
  }

  async function sendBack() {
    const token = getToken(); if (!token || !returning || !returnNote.trim()) return;
    setBusy(true);
    try { await shiftReportsApi.returnToCaregiver(organizationId, returning.id, returnNote.trim(), token); show("Informe devuelto a la cuidadora.", "success"); setReturning(null); }
    catch (e) { show(errorText(e), "danger"); }
    finally { setBusy(false); await load(); }
  }

  if (data === null) return <Skeleton className="h-28" />;
  // Supervisors without an express authorization do not see report content at all.
  if (data === "forbidden") return null;
  if (data === "error") return <Card><p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">No se pudo cargar el informe de turno.</p></Card>;
  if (data.reports.length === 0) {
    return (
      <Card aria-label="Informe de turno" data-testid="shift-report-empty">
        <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]"><FileText size={20} aria-hidden /> Informe de turno</p>
        <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">{data.openVisits > 0 ? "Se generará cuando la cuidadora finalice el turno." : "Aún no hay una visita finalizada en este turno."}</p>
      </Card>
    );
  }
  return (
    <>
      {data.reports.map((report) => {
        const status = STATUS_LABEL[report.status] ?? STATUS_LABEL.DRAFT;
        return (
          <Card key={report.id} aria-label="Informe de turno" data-testid="shift-report">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]"><FileText size={20} aria-hidden /> Informe de turno{report.version > 1 ? ` · versión ${report.version}` : ""}</p>
              <span className="flex flex-wrap gap-1">
                <Badge tone={status.tone}>{status.text}</Badge>
                {report.caregiverWindowExpired && (report.status === "DRAFT" || report.status === "RETURNED") && <Badge tone="neutral" data-testid="shift-report-expired">Plazo de la cuidadora vencido</Badge>}
              </span>
            </div>
            {report.status === "SUBMITTED" && <p className="mb-3 text-[var(--text-small)] text-[var(--color-text-secondary)]">{report.submittedAt ? `La cuidadora lo revisó y lo envió: ${reportShortDate(report.submittedAt)}, ${reportTime(report.submittedAt)}` : "La cuidadora lo revisó y lo envió."}</p>}
            {(report.status === "DRAFT" || report.status === "RETURNED") && !report.caregiverWindowExpired && report.reviewDeadlineAt && <p className="mb-3 text-[var(--text-small)] text-[var(--color-text-secondary)]">La cuidadora puede revisarlo hasta: <span className="whitespace-nowrap">{reportShortDate(report.reviewDeadlineAt)}, {reportTime(report.reviewDeadlineAt)}</span></p>}
            <ShiftReportView content={report.content} />
            {report.caregiverNote && (
              <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-[var(--text-small)]" data-testid="shift-report-caregiver-note">
                <p className="font-medium">Observación final de la cuidadora{report.caregiverNoteAt ? ` · ${reportTime(report.caregiverNoteAt)}` : ""}</p>
                <p className="mt-1 whitespace-pre-line text-[var(--color-text-secondary)]">{report.caregiverNote}</p>
              </div>
            )}
            {report.status === "APPROVED" && report.familySections && (
              <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-[var(--text-small)]" data-testid="shift-report-approved">
                <p className="font-medium">Aprobado {report.approvedAt ? reportTime(report.approvedAt) : ""}{report.approvedBy?.email ? ` · ${report.approvedBy.email}` : ""}</p>
                {report.agencySummary && <p className="mt-1 whitespace-pre-line text-[var(--color-text-secondary)]">Resumen de la agencia: {report.agencySummary}</p>}
                <p className="mt-1 text-[var(--color-text-secondary)]">La familia podrá ver: {FAMILY_ORDER.filter((k) => report.familySections![k]).map((k) => FAMILY_LABEL[k]).join(", ") || "nada"}.</p>
              </div>
            )}
            {report.history && report.history.length > 0 && (
              <details className="mt-3 text-[var(--text-small)]">
                <summary className="flex min-h-11 cursor-pointer items-center font-medium text-[var(--color-text-secondary)]">Historial ({report.history.length})</summary>
                <ul className="flex flex-col gap-1 text-[var(--color-text-secondary)]">
                  {report.history.map((h, i) => <li key={i}>{reportTime(h.at)} · {HISTORY_LABEL[h.type] ?? h.type}{h.actor?.email ? ` · ${h.actor.email}` : ""}</li>)}
                </ul>
              </details>
            )}
            {(report.status === "DRAFT" || report.status === "SUBMITTED" || report.status === "RETURNED") && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {report.status !== "SUBMITTED" && <Button variant="secondary" icon={<RefreshCw size={18} />} disabled={busy} onClick={() => void refresh(report)}>Actualizar borrador</Button>}
                {report.status === "SUBMITTED" && !report.caregiverWindowExpired && !report.ownVisit &&
                  <Button variant="secondary" disabled={busy} data-testid="shift-report-return" onClick={() => { setReturnNote(""); setReturning(report); }}>Devolver a la cuidadora</Button>}
                {report.ownVisit
                  ? <p className="flex min-h-11 items-center text-[var(--text-small)] text-[var(--color-text-secondary)]" data-testid="shift-report-own-visit">Trabajaste este turno: otra persona autorizada debe aprobarlo.</p>
                  : <Button disabled={busy} data-testid="shift-report-approve" onClick={() => { setSections(FAMILY_SECTION_DEFAULTS); setSummary(""); setApproving(report); }}>Revisar y aprobar</Button>}
              </div>
            )}
          </Card>
        );
      })}
      <Modal open={returning !== null} onClose={() => !busy && setReturning(null)} title="Devolver a la cuidadora" sheetOnMobile
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => setReturning(null)}>Volver</Button>
          <Button loading={busy} disabled={!returnNote.trim()} data-testid="shift-report-confirm-return" onClick={() => void sendBack()}>Devolver</Button>
        </div>}>
        <div className="flex flex-col gap-3 text-[var(--text-small)]">
          <p className="text-[var(--color-text-secondary)]">La cuidadora verá tu nota y podrá corregir su observación final dentro de su plazo de 24 horas. Sus registros del turno no cambian.</p>
          <Textarea label="Qué debe revisar" rows={3} maxLength={1000} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} data-testid="shift-report-return-note" />
        </div>
      </Modal>
      <Modal open={approving !== null} onClose={() => !busy && setApproving(null)} title="Aprobar informe de turno" sheetOnMobile
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => setApproving(null)}>Volver</Button>
          <Button loading={busy} data-testid="shift-report-confirm-approve" onClick={() => void approve()}>Aprobar informe</Button>
        </div>}>
        <div className="flex flex-col gap-3 text-[var(--text-small)]">
          <p className="text-[var(--color-text-secondary)]">Una vez aprobado, el informe no se puede cambiar. Elige qué podrá ver la familia cuando esté disponible para ella.</p>
          <fieldset className="flex flex-col">
            <legend className="mb-1 font-medium">Qué verá la familia</legend>
            {FAMILY_ORDER.map((key) => (
              <label key={key} className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--color-border)] last:border-b-0">
                <span>{FAMILY_LABEL[key]}{(key === "incidents" || key === "photos") ? " · requiere tu aprobación expresa" : ""}</span>
                <input type="checkbox" className="h-5 w-5 accent-[var(--color-navy-800)]" checked={sections[key]} data-testid={`family-${key}`}
                  onChange={(e) => setSections((s) => ({ ...s, [key]: e.target.checked }))} />
              </label>
            ))}
          </fieldset>
          <Textarea label="Resumen de la agencia (opcional)" rows={3} maxLength={1000} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}

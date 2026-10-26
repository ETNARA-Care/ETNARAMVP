import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Send } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import { shiftReportsApi, type MyShiftReport } from "@/api/shiftReports";
import { BottomSheet, Button, Card, ErrorState, Skeleton, Textarea, useToast } from "@/components/ui";
import { ShiftReportView } from "@/features/shiftReports/ShiftReportView";
import { reportShortDate, reportTime } from "@/features/shiftReports/reportFormat";
import { caregiverStatus } from "@/features/shiftReports/caregiverStatus";

const HISTORY: Record<string, string> = {
  GENERATED: "Informe generado con tus registros", OBSERVATION_ADDED: "Observación final", SUBMITTED: "Enviado a revisión",
  RETURNED: "Devuelto por la agencia", APPROVED: "Aprobado por la agencia",
};
function errorText(e: unknown) {
  const code = (e as ApiError)?.code;
  if (code === "SHIFT_REPORT_WINDOW_CLOSED") return "Pasaron las 24 horas para revisar este informe. La agencia lo revisará.";
  if (code === "SHIFT_REPORT_NOT_EDITABLE") return "Este informe ya fue enviado.";
  if ((e as ApiError)?.status === 0) return "No hay conexión. Inténtalo cuando vuelva la señal.";
  return "No se pudo guardar. Inténtalo de nuevo.";
}

/**
 * Informe de Turno F2: «Revisar informe». The caregiver checks what she recorded (the
 * snapshot is read-only: her records are never changed here), may add one final
 * observation and sends it to the agency within 24 h of the end of her visit.
 */
export function CaregiverShiftReportPage() {
  const { reportId } = useParams();
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const { show } = useToast();
  const [report, setReport] = useState<MyShiftReport | null | "error" | "missing">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !reportId || !token) return;
    try { const r = (await shiftReportsApi.myReport(organizationId, reportId, token)).report; setReport(r); setNote(r.caregiverNote ?? ""); }
    catch (e) { setReport((e as ApiError)?.status === 404 ? "missing" : "error"); }
  }, [organizationId, reportId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { void load(); }, [load]);

  async function saveNote() {
    const token = getToken(); if (!organizationId || !reportId || !token || !note.trim()) return;
    setBusy(true);
    try { const r = (await shiftReportsApi.setMyObservation(organizationId, reportId, note.trim(), token)).report; setReport(r); show("Observación guardada.", "success"); }
    catch (e) { show(errorText(e), "danger"); }
    finally { setBusy(false); }
  }
  async function submit() {
    const token = getToken(); if (!organizationId || !reportId || !token || report === null || typeof report === "string") return;
    setBusy(true);
    try {
      // A typed observation that was not saved yet goes with the report.
      if (note.trim() && note.trim() !== (report.caregiverNote ?? "")) await shiftReportsApi.setMyObservation(organizationId, reportId, note.trim(), token);
      const r = (await shiftReportsApi.submitMine(organizationId, reportId, token)).report;
      setReport(r); setConfirm(false); show("Informe enviado a la agencia.", "success");
    } catch (e) { show(errorText(e), "danger"); setConfirm(false); await load(); }
    finally { setBusy(false); }
  }

  if (report === null) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (report === "missing") return <ErrorState kind="not_found" />;
  if (report === "error") return <ErrorState kind="network" onRetry={() => void load()} />;
  const st = caregiverStatus(report.status, report.canEdit);
  const returned = [...report.history].reverse().find((h) => h.type === "RETURNED");

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Link to="/caregiver/shift-reports" className="w-fit text-sm font-medium text-[var(--color-text-secondary)]">← Mis informes</Link>
      <section className="rounded-[var(--radius-lg)] bg-[var(--color-navy-900)] p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Informe de turno</p>
          <span className="max-w-full rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--color-navy-900)]" data-testid="report-status">{st.text}</span>
        </div>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl">{report.content.recipient.name}</h1>
        <p className="mt-1 text-sm text-white/80 first-letter:uppercase">{reportShortDate(report.content.shift.scheduledStart)}</p>
        {report.canEdit && report.reviewDeadlineAt && <p className="mt-3 rounded-[var(--radius-md)] bg-white/10 px-3 py-2 text-sm">Revísalo y envíalo antes de: <strong className="whitespace-nowrap">{reportShortDate(report.reviewDeadlineAt)}, {reportTime(report.reviewDeadlineAt)}</strong></p>}
      </section>

      {report.status === "RETURNED" && returned?.note && (
        <Card className="border-[var(--color-danger-100)]" data-testid="returned-note">
          <p className="font-medium text-[var(--color-text-primary)]">La agencia te lo devolvió</p>
          <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-text-secondary)]">{returned.note}</p>
        </Card>
      )}

      {report.canEdit && <p className="text-sm text-[var(--color-text-secondary)]">Esto es lo que registraste durante el turno. No tienes que escribirlo de nuevo. Si algo falta o está mal, explícalo en tu observación final.</p>}
      <Card><ShiftReportView content={report.content} /></Card>

      <Card className="flex flex-col gap-3" data-testid="caregiver-observation">
        {report.canEdit ? <>
          <Textarea label="Observación final (opcional)" rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Algo que la agencia deba saber de este turno." />
          <p className="text-xs text-[var(--color-text-muted)]">Se añade al informe. Tus registros originales no cambian. {note.length}/1000</p>
          {note.trim() && note.trim() !== (report.caregiverNote ?? "") && <Button variant="secondary" disabled={busy} onClick={() => void saveNote()}>Guardar observación</Button>}
        </> : <>
          <p className="font-medium text-[var(--color-text-primary)]">Observación final</p>
          <p className="whitespace-pre-line text-sm text-[var(--color-text-secondary)]">{report.caregiverNote ?? "Sin observación."}</p>
        </>}
      </Card>

      {report.canEdit && (
        <Button size="lg" fullWidth icon={<Send size={20} />} disabled={busy} data-testid="submit-report" onClick={() => setConfirm(true)}>Enviar a revisión</Button>
      )}
      {!report.canEdit && report.status === "SUBMITTED" && <p className="text-center text-sm text-[var(--color-text-secondary)]" data-testid="submitted-state">{report.submittedAt ? `Enviado a las ${reportTime(report.submittedAt).replace(/\.$/, "")}` : "Enviado"}. La agencia lo revisará.</p>}
      {!report.canEdit && (report.status === "DRAFT" || report.status === "RETURNED") && <p className="text-center text-sm text-[var(--color-text-secondary)]" data-testid="expired-state">Pasaron las 24 horas. La agencia revisará este informe.</p>}

      {report.history.length > 0 && (
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-[var(--color-text-secondary)]">Historial ({report.history.length})</summary>
          <ul className="flex flex-col gap-1 text-[var(--color-text-secondary)]">
            {report.history.map((h, i) => <li key={i}>{reportTime(h.at)} · {HISTORY[h.type] ?? h.type}{h.type === "OBSERVATION_ADDED" && h.byMe ? " (tú)" : ""}</li>)}
          </ul>
        </details>
      )}

      <BottomSheet open={confirm} onClose={() => !busy && setConfirm(false)} title="¿Enviar el informe a la agencia?"
        footer={<><Button variant="secondary" fullWidth disabled={busy} onClick={() => setConfirm(false)}>Volver</Button><Button fullWidth disabled={busy} data-testid="confirm-submit" onClick={() => void submit()}>{busy ? "Enviando..." : "Enviar"}</Button></>}>
        <p className="text-sm text-[var(--color-text-secondary)]">Después de enviarlo no podrás cambiar tu observación, salvo que la agencia te lo devuelva.</p>
      </BottomSheet>
    </div>
  );
}

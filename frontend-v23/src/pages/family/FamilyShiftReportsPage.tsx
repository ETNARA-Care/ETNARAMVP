import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Download, FileText } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import { familyShiftReportsApi, type FamilyShiftReport, type FamilyShiftReportListItem } from "@/api/shiftReports";
import { Button, Card, EmptyState, ErrorState, Skeleton, useToast } from "@/components/ui";
import { pickRecipient, familyRecipientName, useFamilyRecipient } from "@/features/family/familyRecipient";
import { FamilyShiftReportView } from "@/features/shiftReports/FamilyShiftReportView";
import { reportShortDate, reportTime } from "@/features/shiftReports/reportFormat";

/**
 * Informe de Turno F3 (family): approved reports of the relative selected in the portal.
 * Only what the agency shared; the PDF is generated on the server from the same version.
 */
function useSelectedRecipient() {
  const { recipients, selectedKey } = useFamilyRecipient();
  const { activeOrganization } = useAuth();
  return { recipient: pickRecipient(recipients, activeOrganization?.id, selectedKey), loaded: recipients.length > 0 };
}

export function FamilyShiftReportsPage() {
  const { recipient } = useSelectedRecipient();
  const [rows, setRows] = useState<FamilyShiftReportListItem[] | null | "error">(null);
  const load = useCallback(async () => {
    const token = getToken();
    if (!recipient || !token) return;
    setRows(null);
    try { setRows((await familyShiftReportsApi.list(recipient.organizationId, recipient.recipientId, token)).reports); }
    catch (e) { setRows((e as ApiError)?.status === 404 ? [] : "error"); }
  }, [recipient]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount / when the relative changes
  useEffect(() => { void load(); }, [load]);
  const name = recipient ? familyRecipientName(recipient) : "tu familiar";
  return (
    <div className="space-y-5">
      <Link to="/family/history" className="text-sm font-medium text-[#667085]">← Turnos</Link>
      <section>
        <p className="text-sm font-medium text-[#66845f]">Aprobados por la agencia</p>
        <h1 className="mt-1 font-display text-[2rem] leading-tight text-[#102b57]">Informes de {name}</h1>
        <p className="mt-1 text-sm text-[#667085]">Un resumen de cada turno, con lo que la agencia decidió compartir contigo.</p>
      </section>
      {rows === null ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        : rows === "error" ? <ErrorState kind="network" onRetry={() => void load()} />
        : rows.length === 0 ? <EmptyState icon={<FileText size={28} />} title="Aún no hay informes" description="Cuando la agencia apruebe el informe de un turno, aparecerá aquí." />
        : (
          <ul className="space-y-3" data-testid="family-report-list">
            {rows.map((r) => (
              <li key={r.id}>
                <Link to={`/family/shift-reports/${r.id}`} className="block">
                  <Card className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--color-text-primary)] first-letter:uppercase">{reportShortDate(`${r.serviceDate}T16:00:00Z`)}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{r.scheduledStart && r.scheduledEnd && <span className="whitespace-nowrap">{reportTime(r.scheduledStart)} – {reportTime(r.scheduledEnd)} · </span>}{r.caregiverName ?? "Cuidadora"}</p>
                    </div>
                    <ChevronRight size={18} aria-hidden className="shrink-0 text-[var(--color-text-muted)]" />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

export function FamilyShiftReportPage() {
  const { reportId } = useParams();
  const { recipient, loaded } = useSelectedRecipient();
  const { show } = useToast();
  const [report, setReport] = useState<FamilyShiftReport | null | "missing" | "error">(null);
  const [downloading, setDownloading] = useState(false);
  const load = useCallback(async () => {
    const token = getToken();
    if (!recipient || !reportId || !token) return;
    try { setReport((await familyShiftReportsApi.get(recipient.organizationId, recipient.recipientId, reportId, token)).report); }
    catch (e) { setReport((e as ApiError)?.status === 404 || (e as ApiError)?.status === 403 ? "missing" : "error"); }
  }, [recipient, reportId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { void load(); }, [load]);

  async function download() {
    const token = getToken();
    if (!recipient || !reportId || !token || typeof report !== "object" || !report) return;
    setDownloading(true);
    try {
      const blob = await familyShiftReportsApi.pdf(recipient.organizationId, recipient.recipientId, reportId, token);
      // A temporary in-memory link for this download only; nothing is stored or shared.
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `informe-de-turno-${report.serviceDate}-${report.id.slice(0, 8)}.pdf`; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      const status = (e as ApiError)?.status;
      show(status === 0 ? "No hay conexión. Inténtalo cuando vuelva la señal." : status === 404 || status === 403 ? "Este informe ya no está disponible." : "No se pudo descargar el PDF. Inténtalo de nuevo.", "danger");
    } finally { setDownloading(false); }
  }

  if (!loaded || report === null) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (report === "missing") return <ErrorState kind="not_found" />;
  if (report === "error") return <ErrorState kind="network" onRetry={() => void load()} />;
  return (
    <div className="space-y-4 pb-6">
      <Link to="/family/shift-reports" className="text-sm font-medium text-[#667085]">← Informes</Link>
      <section className="rounded-[22px] bg-[#102b57] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#b8c9ad]">Informe de turno</p>
          <span className="rounded-full bg-[#b8c9ad] px-3 py-1 text-xs font-semibold text-[#102b57]">Aprobado</span>
        </div>
        <h1 className="mt-1 font-display text-2xl">{report.recipient.name}</h1>
        <p className="mt-1 text-sm text-white/75 first-letter:uppercase">{reportShortDate(`${report.serviceDate}T16:00:00Z`)}</p>
      </section>
      <Button size="lg" fullWidth icon={<Download size={20} />} disabled={downloading} onClick={() => void download()} data-testid="family-report-pdf">
        {downloading ? "Preparando PDF..." : "Descargar PDF"}
      </Button>
      <Card><FamilyShiftReportView report={report} /></Card>
    </div>
  );
}

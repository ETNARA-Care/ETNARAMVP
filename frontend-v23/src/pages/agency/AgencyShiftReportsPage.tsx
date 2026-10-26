import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { shiftReportsApi, type ShiftReportListItem } from "@/api/shiftReports";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { StatusChip } from "@/features/shiftReports/StatusChip";
import { STATUS_LABEL, reportShortDate, reportTime } from "@/features/shiftReports/reportFormat";
import { ShiftReportReviewersCard } from "@/features/shiftReports/ShiftReportReviewersCard";

/** Informe de Turno F1+F2: the agency's list. «Por aprobar» = drafts, sent by the caregiver and returned; sent ones first. */
export function AgencyShiftReportsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | undefined>("PENDING");
  const [reports, setReports] = useState<ShiftReportListItem[] | null | "error">(null);
  const [access, setAccess] = useState<{ canReview: boolean; canManageReviewers: boolean } | null>(null);
  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setReports(null);
    try {
      const a = await shiftReportsApi.access(organizationId, token);
      setAccess(a);
      if (!a.canReview) return;
      setReports((await shiftReportsApi.list(organizationId, token, filter)).reports);
    } catch { setReports("error"); }
  }, [organizationId, filter]);
  useEffect(() => { void load(); }, [load]);

  const tabs: Array<{ key: "PENDING" | "APPROVED" | undefined; label: string }> = [
    { key: "PENDING", label: "Por aprobar" }, { key: "APPROVED", label: "Aprobados" }, { key: undefined, label: "Todos" },
  ];
  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <PageHeader title="Informes de turno" description="Generados con los registros reales de cada visita. Revísalos y apruébalos antes de compartirlos." />
      {access && !access.canReview && (
        <Card data-testid="shift-reports-not-authorized"><p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Para revisar y aprobar informes, un administrador de la agencia debe autorizarte.</p></Card>
      )}
      {access?.canManageReviewers && organizationId && <ShiftReportReviewersCard organizationId={organizationId} />}
      {access?.canReview && <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar informes">
        {tabs.map((t) => (
          <button key={t.label} type="button" aria-pressed={filter === t.key} onClick={() => setFilter(t.key)}
            className={`min-h-11 rounded-full border px-4 text-[var(--text-small)] font-medium ${filter === t.key ? "border-[var(--color-navy-900)] bg-[var(--color-navy-900)] text-white" : "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {reports === null ? <div className="flex flex-col gap-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        : reports === "error" ? <ErrorState kind="network" onRetry={() => void load()} />
        : reports.length === 0 ? <EmptyState icon={<FileText size={28} />} title={filter === "PENDING" ? "No hay informes por aprobar" : "No hay informes"} description="Aparecen cuando una cuidadora finaliza su turno." />
        : (
          <ul className="flex flex-col gap-2" data-testid="shift-report-list">
            {reports.map((r) => {
              const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.DRAFT;
              const expired = r.caregiverWindowExpired && (r.status === "DRAFT" || r.status === "RETURNED");
              return (
                <li key={r.id}>
                  <Link to={`/agency/shifts/${r.shiftId}`} className="block" data-testid="agency-report-card">
                    <Card className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 break-words font-medium text-[var(--color-text-primary)]">{r.recipientName ?? "Residente"}</p>
                        <ChevronRight size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                      </div>
                      {r.scheduledStart && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] first-letter:uppercase">{reportShortDate(r.scheduledStart)} · {reportTime(r.scheduledStart)}</p>}
                      <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{r.caregiverName ?? "Cuidadora"} · {r.totals?.careEvents ?? 0} registro{r.totals?.careEvents === 1 ? "" : "s"}</p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {expired ? <StatusChip tone="neutral" testId="agency-report-status">Plazo vencido</StatusChip>
                          : <StatusChip tone={st.tone} testId="agency-report-status">{r.status === "SUBMITTED" ? "Enviado por la cuidadora" : st.text}</StatusChip>}
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </>}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { shiftReportsApi, type MyShiftReportListItem } from "@/api/shiftReports";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { StatusChip } from "@/features/shiftReports/StatusChip";
import { reportShortDate, reportTime } from "@/features/shiftReports/reportFormat";
import { caregiverStatus } from "@/features/shiftReports/caregiverStatus";

/** Informe de Turno F2: the caregiver's own reports (only her visits). */
export function CaregiverShiftReportsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [rows, setRows] = useState<MyShiftReportListItem[] | null | "error">(null);
  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    try { setRows((await shiftReportsApi.mine(organizationId, token)).reports); } catch { setRows("error"); }
  }, [organizationId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount, as the other caregiver pages
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Link to="/caregiver/shifts" className="text-sm font-medium text-[var(--color-text-secondary)]">← Turnos</Link>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl text-[var(--color-navy-900)]">Mis informes</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Revisa cada informe y envíalo a la agencia dentro de las 24 horas siguientes al turno.</p>
      </header>
      {rows === null ? <div className="flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        : rows === "error" ? <ErrorState kind="network" onRetry={() => void load()} />
        : rows.length === 0 ? <EmptyState icon={<FileText size={28} />} title="Aún no tienes informes" description="Cuando finalices un turno, tu informe aparecerá aquí." />
        : (
          <ul className="flex flex-col gap-3" data-testid="my-report-list">
            {rows.map((r) => {
              const st = caregiverStatus(r.status, r.canEdit);
              return (
                <li key={r.id}>
                  <Link to={`/caregiver/shift-reports/${r.id}`} className="block" data-testid="my-report-card">
                    <Card className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 break-words font-medium text-[var(--color-text-primary)]">{r.recipientName ?? "Residente"}</p>
                        <ChevronRight size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                      </div>
                      {r.scheduledStart && <p className="text-sm text-[var(--color-text-secondary)] first-letter:uppercase">{reportShortDate(r.scheduledStart)} · {reportTime(r.scheduledStart)}</p>}
                      {r.canEdit && r.reviewDeadlineAt && <p className="text-xs text-[var(--color-warning-700)]">Envíalo antes de: {reportShortDate(r.reviewDeadlineAt)}, {reportTime(r.reviewDeadlineAt)}</p>}
                      <div className="pt-0.5"><StatusChip tone={st.tone} testId="my-report-status">{st.text}</StatusChip></div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}

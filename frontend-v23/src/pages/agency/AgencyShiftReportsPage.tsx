import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { shiftReportsApi, type ShiftReportListItem } from "@/api/shiftReports";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { STATUS_LABEL, reportDate, reportTime } from "@/features/shiftReports/reportFormat";

/** Informe de Turno F1: the agency's list. Drafts of visits finished in the last 7 days appear on their own. */
export function AgencyShiftReportsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [filter, setFilter] = useState<"DRAFT" | "APPROVED" | undefined>("DRAFT");
  const [reports, setReports] = useState<ShiftReportListItem[] | null | "error">(null);
  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setReports(null);
    try { setReports((await shiftReportsApi.list(organizationId, token, filter)).reports); }
    catch { setReports("error"); }
  }, [organizationId, filter]);
  useEffect(() => { void load(); }, [load]);

  const tabs: Array<{ key: "DRAFT" | "APPROVED" | undefined; label: string }> = [
    { key: "DRAFT", label: "Por aprobar" }, { key: "APPROVED", label: "Aprobados" }, { key: undefined, label: "Todos" },
  ];
  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <PageHeader title="Informes de turno" description="Generados con los registros reales de cada visita. Revísalos y apruébalos antes de compartirlos." />
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
        : reports.length === 0 ? <EmptyState icon={<FileText size={28} />} title={filter === "DRAFT" ? "No hay informes por aprobar" : "No hay informes"} description="Aparecen cuando una cuidadora finaliza su turno." />
        : (
          <ul className="flex flex-col gap-2" data-testid="shift-report-list">
            {reports.map((r) => {
              const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.DRAFT;
              return (
                <li key={r.id}>
                  <Link to={`/agency/shifts/${r.shiftId}`} className="block">
                    <Card className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--color-text-primary)]">{r.recipientName ?? "Residente"}</p>
                        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] first-letter:uppercase">
                          {r.scheduledStart ? `${reportDate(r.scheduledStart)} · ${reportTime(r.scheduledStart)}` : ""}
                        </p>
                        <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{r.caregiverName ?? "Cuidadora"} · {r.totals?.careEvents ?? 0} registro{r.totals?.careEvents === 1 ? "" : "s"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2"><Badge tone={st.tone}>{st.text}</Badge><ChevronRight size={18} aria-hidden className="text-[var(--color-text-muted)]" /></div>
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

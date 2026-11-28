import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { useOrgFeature } from "@/auth/orgFeatures";
import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton, Tabs, useToast } from "@/components/ui";
import { residentialApi, type ResidentialEstablishmentSummary } from "@/api/residential";
import { reportErrorMessage, reportsApi, type AssignmentsReport, type AttendanceReport } from "@/api/residentialReports";
import { csvLines } from "@/features/export/csv";
import type { SubstitutionReason } from "@/api/residentialAssignments";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";
import { isResidentialOrganization } from "@/features/residential/modality";
import { assignmentsReportCsvRows, attendanceReportCsvRows, hours, occupancyCsvRows, rangeValid, REPORT_MAX_DAYS } from "@/features/residential/reports";
import { addDays, puertoRicoDate } from "@/features/residential/schedule";

/**
 * 177 (hogares F5): informes administrativos del hogar. Solo hogares y solo administración.
 * - Asistencia y horas trabajadas (solo con HOGAR_PONCHES): rango libre de 1 a 31 días; validadas y pendientes siempre
 *   por separado; CSV que dice que no es nómina.
 * - Asignaciones (solo con HOGAR_ASIGNACIONES): turnos, sustituciones y alertas de cobertura del rango.
 * - Ocupación: habitaciones, camas y residentes por establecimiento (nunca capacidad autorizada).
 * El portal no calcula nada: muestra lo que devuelve el backend.
 */
type Tab = "attendance" | "assignments" | "occupancy";
const fmt = (iso: string | null, lang: string | undefined) => (iso ? new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-PR", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" }) : "—");
const download = (rows: string[][], name: string) => {
  // BOM UTF-8: Excel abre bien los acentos.
  const blob = new Blob(["\uFEFF" + csvLines(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
};

export function ResidentialReportsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  const attendanceOn = useOrgFeature("HOGAR_PONCHES");
  const assignmentsOn = useOrgFeature("HOGAR_ASIGNACIONES");
  const { t, i18n } = useTranslation("residential");
  const lang = i18n.resolvedLanguage;
  const toast = useToast();
  const tabs: Tab[] = [...(attendanceOn ? ["attendance" as const] : []), ...(assignmentsOn ? ["assignments" as const] : []), "occupancy"];
  const [tabChoice, setTab] = useState<Tab | null>(null);
  const tab = tabChoice && tabs.includes(tabChoice) ? tabChoice : tabs[0];
  const [estState, setEstState] = useState<OrganizationScoped<ResidentialEstablishmentSummary[]> | null>(null);
  const [selected, setSelected] = useState<{ organizationId: string; locationId: string } | null>(null);
  const today = puertoRicoDate();
  const [from, setFrom] = useState(() => addDays(today, -6));
  const [to, setTo] = useState(today);
  const [reportState, setReportState] = useState<OrganizationScoped<{ attendance?: AttendanceReport; assignments?: AssignmentsReport }> | null>(null);
  const [busy, setBusy] = useState(false);
  const latestList = useRef(createLatestRequest());
  const latest = useRef(createLatestRequest());

  const loadEstablishments = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential) return;
    const request = latestList.current.begin();
    try {
      const { establishments } = await residentialApi.listEstablishments(organizationId, token);
      if (request.isCurrent()) setEstState({ organizationId, data: establishments.filter((e) => e.status === "active"), error: false });
    } catch {
      if (request.isCurrent()) setEstState({ organizationId, data: null, error: true });
    }
  }, [organizationId, residential]);
  useEffect(() => {
    const tracker = latestList.current;
    void loadEstablishments();
    return () => tracker.invalidate();
  }, [loadEstablishments]);
  const establishments = scopedTo(estState, organizationId)?.data ?? null;
  const listError = scopedTo(estState, organizationId)?.error === true;
  const chosen = selected && selected.organizationId === organizationId ? selected.locationId : null;
  const locationId = establishments?.some((e) => e.id === chosen) ? chosen : establishments?.[0]?.id ?? null;
  const key = locationId ? `${tab}|${locationId}|${from}|${to}` : undefined;
  const valid = rangeValid(from, to);

  /** Solo se pide al pulsar «Generar»: el informe es del rango y el establecimiento elegidos en ese momento. */
  const generate = async () => {
    const token = getToken();
    if (!organizationId || !token || !locationId || !valid || tab === "occupancy") return;
    const request = latest.current.begin();
    const k = `${tab}|${locationId}|${from}|${to}`;
    setBusy(true);
    try {
      const data = tab === "attendance"
        ? { attendance: (await reportsApi.attendance(organizationId, locationId, from, to, token)).report }
        : { assignments: (await reportsApi.assignments(organizationId, locationId, from, to, token)).report };
      if (request.isCurrent()) setReportState({ organizationId, key: k, data, error: false });
    } catch (e) {
      if (request.isCurrent()) { setReportState({ organizationId, key: k, data: null, error: true }); toast.show(reportErrorMessage(e), "danger"); }
    } finally { setBusy(false); }
  };
  const report = scopedTo(reportState, organizationId, key)?.data ?? null;

  if (!residential) return <Navigate to="/agency" replace />;
  return (
    <div className="flex flex-col gap-6" data-testid="residential-reports">
      <PageHeader title={t("reports.title")} description={t("reports.description")} />
      {listError ? <ErrorState kind="server" onRetry={() => { setEstState(null); void loadEstablishments(); }} /> : establishments === null ? <Skeleton className="h-32" /> : establishments.length === 0 ? (
        <EmptyState title={t("reports.noEstablishmentsTitle")} description={t("reports.noEstablishmentsDetail")} />
      ) : (
        <>
          <Tabs value={tab} onChange={(id) => setTab(id as Tab)} items={tabs.map((x) => ({ id: x, label: t(`reports.tabs.${x}`) }))} />
          {tab === "occupancy" ? <OccupancyReport establishments={establishments} /> : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                {establishments.length > 1 && (
                  <div className="w-full sm:w-[20rem]">
                    <Select label={t("reports.establishment")} value={locationId ?? ""} onChange={(e) => organizationId && setSelected({ organizationId, locationId: e.target.value })}>
                      {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </Select>
                  </div>
                )}
                <div className="w-full sm:w-[11rem]"><Input type="date" label={t("reports.from")} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></div>
                <div className="w-full sm:w-[11rem]"><Input type="date" label={t("reports.to")} value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></div>
                <Button disabled={busy || !valid} onClick={() => void generate()}>{t("reports.generate")}</Button>
              </div>
              {!valid && <p className="text-[var(--text-small)] text-[var(--color-warning-700)]" data-testid="report-range-hint">{t("reports.rangeHint", { max: REPORT_MAX_DAYS })}</p>}
              {busy ? <Skeleton className="h-48" /> : !report ? <p className="text-[var(--color-text-secondary)]">{t("reports.pick")}</p>
                : report.attendance ? <AttendanceReportView report={report.attendance} language={lang} />
                : report.assignments ? <AssignmentsReportView report={report.assignments} language={lang} /> : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-[var(--spacing-md)]">
      <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{label}</p>
      <p className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{value}</p>
    </Card>
  );
}

function AttendanceReportView({ report, language }: { report: AttendanceReport; language: string | undefined }) {
  const { t } = useTranslation("residential");
  const exportCsv = () => download(attendanceReportCsvRows(report, t("reports.attendance.csvNotice"), {
    people: (["person", "shifts", "validated", "pending", "late", "early", "absences", "open"] as const).map((k) => t(`reports.attendance.csvPeople.${k}`)),
    detail: (["start", "end", "person", "firstIn", "lastOut", "validated", "pending", "lateMin", "earlyMin", "absent"] as const).map((k) => t(`reports.attendance.csvDetail.${k}`)),
    yes: t("reports.yes"), no: t("reports.no"),
  }), `etnara-asistencia-${report.from}-${report.to}.csv`);
  return (
    <div className="flex flex-col gap-4" data-testid="attendance-report">
      <p className="rounded-[var(--radius-md)] border border-[var(--color-warning-700)]/40 bg-[var(--color-warning-100)] p-3 text-[var(--text-small)] text-[var(--color-warning-700)]">{t("reports.attendance.notPayroll")}</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t("reports.attendance.validatedHours")} value={hours(report.totals.validatedMinutes)} />
        <Stat label={t("reports.attendance.pendingHours")} value={hours(report.totals.pendingMinutes)} />
        <Stat label={t("reports.attendance.shifts")} value={report.totals.shifts} />
        <Stat label={t("reports.attendance.absences")} value={report.totals.absences} />
      </div>
      <div className="flex justify-end"><Button variant="secondary" size="sm" onClick={exportCsv}>{t("reports.exportCsv")}</Button></div>
      {report.people.length === 0 ? <EmptyState title={t("reports.emptyTitle")} description={t("reports.emptyDetail")} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-[var(--text-small)]">
            <thead className="text-[var(--color-text-secondary)]"><tr>
              {(["person", "shifts", "validated", "pending", "late", "early", "absences", "open"] as const).map((k) => <th key={k} className="px-3 py-2 font-medium">{t(`reports.attendance.csvPeople.${k}`)}</th>)}
            </tr></thead>
            <tbody>
              {report.people.map((p) => (
                <tr key={p.membershipId} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 text-[var(--color-text-primary)]">{p.workerName ?? "—"}</td>
                  <td className="px-3 py-2">{p.shifts}</td>
                  <td className="px-3 py-2">{hours(p.validatedMinutes)}</td>
                  <td className="px-3 py-2">{p.pendingMinutes > 0 ? <Badge tone="warning">{hours(p.pendingMinutes)}</Badge> : hours(0)}</td>
                  <td className="px-3 py-2">{p.lateCount}</td>
                  <td className="px-3 py-2">{p.earlyLeaveCount}</td>
                  <td className="px-3 py-2">{p.absences}</td>
                  <td className="px-3 py-2">{p.openSessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {report.rows.length > 0 && (
        <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
          <summary className="cursor-pointer font-medium text-[var(--color-text-primary)]">{t("reports.attendance.detail", { count: report.rows.length })}</summary>
          <ul className="mt-2 flex flex-col divide-y divide-[var(--color-border)]">
            {report.rows.map((r) => (
              <li key={`${r.shiftId}|${r.membershipId}`} className="py-2 text-[var(--text-small)]">
                <span className="text-[var(--color-text-primary)]">{`${fmt(r.scheduledStart, language)} – ${fmt(r.scheduledEnd, language)} · ${r.workerName ?? "—"}`}</span>
                <span className="block text-[var(--color-text-secondary)]">{t("reports.attendance.rowLine", { validated: hours(r.validatedMinutes), pending: hours(r.pendingMinutes) })}
                  {r.absent ? ` · ${t("reports.attendance.absent")}` : ""}{r.openSession ? ` · ${t("reports.attendance.openSession")}` : ""}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function AssignmentsReportView({ report, language }: { report: AssignmentsReport; language: string | undefined }) {
  const { t } = useTranslation("residential");
  const exportCsv = () => download(assignmentsReportCsvRows(report, {
    shifts: (["start", "end", "status", "staff", "residents", "substitutions", "alerts"] as const).map((k) => t(`reports.assignments.csvShifts.${k}`)),
    substitutions: (["at", "original", "substitute", "reason", "full", "uncovered"] as const).map((k) => t(`reports.assignments.csvSubs.${k}`)),
    alerts: (["from", "resident", "reason", "resolved"] as const).map((k) => t(`reports.assignments.csvAlerts.${k}`)),
    reason: (code) => t(`assignments.reasons.${code as SubstitutionReason}`), yes: t("reports.yes"), no: t("reports.no"),
  }), `etnara-asignaciones-${report.from}-${report.to}.csv`);
  return (
    <div className="flex flex-col gap-4" data-testid="assignments-report">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t("reports.assignments.shifts")} value={report.totals.shifts} />
        <Stat label={t("reports.assignments.substitutions")} value={report.totals.substitutions} />
        <Stat label={t("reports.assignments.alerts")} value={report.totals.coverageAlerts} />
        <Stat label={t("reports.assignments.openAlerts")} value={report.totals.openCoverageAlerts} />
      </div>
      <div className="flex justify-end"><Button variant="secondary" size="sm" onClick={exportCsv}>{t("reports.exportCsv")}</Button></div>
      {report.shifts.length === 0 ? <EmptyState title={t("reports.emptyTitle")} description={t("reports.emptyDetail")} /> : (
        <ul className="flex flex-col gap-2">
          {report.shifts.map((s) => (
            <li key={s.shiftId}><Card className="p-[var(--spacing-md)] text-[var(--text-small)]">
              <p className="font-medium text-[var(--color-text-primary)]">{`${fmt(s.scheduledStart, language)} – ${fmt(s.scheduledEnd, language)}`}{s.status === "cancelled" ? ` · ${t("reports.assignments.cancelled")}` : ""}</p>
              <p className="text-[var(--color-text-secondary)]">{t("reports.assignments.shiftLine", { staff: s.staff, residents: s.residents, substitutions: s.substitutions, alerts: s.coverageAlerts })}</p>
            </Card></li>
          ))}
        </ul>
      )}
      {report.substitutions.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold text-[var(--color-text-primary)]">{t("reports.assignments.substitutionsTitle")}</h3>
          <ul className="flex flex-col gap-1 text-[var(--text-small)]">
            {report.substitutions.map((s, i) => <li key={`${s.shiftId}|${i}`}>{t("assignments.history.substitutionLine", { original: s.original ?? "—", substitute: s.substitute ?? "—", at: fmt(s.effectiveAt, language), reason: t(`assignments.reasons.${s.reasonCode as SubstitutionReason}`) })}</li>)}
          </ul>
        </section>
      )}
      {report.coverageAlerts.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold text-[var(--color-text-primary)]">{t("reports.assignments.alertsTitle")}</h3>
          <ul className="flex flex-col gap-1 text-[var(--text-small)]">
            {report.coverageAlerts.map((a, i) => <li key={`${a.shiftId}|${i}`}>{`${fmt(a.uncoveredFrom, language)} · ${a.resident} · ${a.reason}`}{a.resolvedAt ? ` · ${t("assignments.alerts.resolved")}` : ""}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

function OccupancyReport({ establishments }: { establishments: ResidentialEstablishmentSummary[] }) {
  const { t } = useTranslation("residential");
  const cols = ["establishment", "rooms", "beds", "occupied", "available", "residents", "withoutRoom", "percent"] as const;
  const exportCsv = () => download(occupancyCsvRows(establishments, cols.map((k) => t(`reports.occupancy.${k}`)), t("reports.occupancy.notConfigured")), "etnara-ocupacion.csv");
  return (
    <div className="flex flex-col gap-3" data-testid="occupancy-report">
      <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("reports.occupancy.notice")}</p>
      <div className="flex justify-end"><Button variant="secondary" size="sm" onClick={exportCsv}>{t("reports.exportCsv")}</Button></div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-[var(--text-small)]">
          <thead className="text-[var(--color-text-secondary)]"><tr>{cols.map((k) => <th key={k} className="px-3 py-2 font-medium">{t(`reports.occupancy.${k}`)}</th>)}</tr></thead>
          <tbody>
            {establishments.map((e) => (
              <tr key={e.id} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 text-[var(--color-text-primary)]">{e.name}</td>
                <td className="px-3 py-2">{e.occupancy.rooms}</td>
                <td className="px-3 py-2">{e.occupancy.capacityConfigured ? e.occupancy.bedsRegistered : t("reports.occupancy.notConfigured")}</td>
                <td className="px-3 py-2">{e.occupancy.bedsOccupied}</td>
                <td className="px-3 py-2">{e.occupancy.bedsAvailable}</td>
                <td className="px-3 py-2">{e.occupancy.activeResidents}</td>
                <td className="px-3 py-2">{e.occupancy.residentsWithoutRoom}</td>
                <td className="px-3 py-2">{e.occupancy.occupancyPercent === null ? t("reports.occupancy.notConfigured") : `${e.occupancy.occupancyPercent}%`}{e.occupancy.overCapacity ? <span className="ml-2"><Badge tone="warning">{t("reports.occupancy.over")}</Badge></span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

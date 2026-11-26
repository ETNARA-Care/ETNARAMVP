import type { AssignmentsReport, AttendanceReport } from "@/api/residentialReports";
import type { ResidentialEstablishmentSummary } from "@/api/residential";

/** 177 (F5): ayudas puras de los informes. El rango lo valida el backend (1 a 31 días); aquí solo se anticipa. */
export const REPORT_MAX_DAYS = 31;
export function rangeDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) + 1 : 0;
}
export const rangeValid = (from: string, to: string) => { const d = rangeDays(from, to); return d >= 1 && d <= REPORT_MAX_DAYS; };
export const hours = (minutes: number) => (minutes / 60).toFixed(2);
const local = (iso: string) => new Date(iso).toLocaleString("sv-SE", { timeZone: "America/Puerto_Rico" }).slice(0, 16);

/** CSV de asistencia: primera línea con el aviso (no es nómina); luego totales por persona y detalle por turno. */
export function attendanceReportCsvRows(r: AttendanceReport, notice: string, labels: { people: string[]; detail: string[]; yes: string; no: string }): string[][] {
  const out: string[][] = [[notice], [`${r.establishment.name}`, r.from, r.to], [], labels.people];
  for (const p of r.people) out.push([p.workerName ?? "", String(p.shifts), hours(p.validatedMinutes), hours(p.pendingMinutes), String(p.lateCount), String(p.earlyLeaveCount), String(p.absences), String(p.openSessions)]);
  out.push([], labels.detail);
  for (const x of r.rows) out.push([local(x.scheduledStart), local(x.scheduledEnd), x.workerName ?? "", x.firstInAt ? local(x.firstInAt) : "", x.lastOutAt ? local(x.lastOutAt) : "",
    hours(x.validatedMinutes), hours(x.pendingMinutes), String(x.lateMinutes), String(x.earlyLeaveMinutes), x.absent ? labels.yes : labels.no]);
  return out;
}
export function assignmentsReportCsvRows(r: AssignmentsReport, labels: { shifts: string[]; substitutions: string[]; alerts: string[]; reason: (code: string) => string; yes: string; no: string }): string[][] {
  const out: string[][] = [[`${r.establishment.name}`, r.from, r.to], [], labels.shifts];
  for (const s of r.shifts) out.push([local(s.scheduledStart), local(s.scheduledEnd), s.status, String(s.staff), String(s.residents), String(s.substitutions), String(s.coverageAlerts)]);
  out.push([], labels.substitutions);
  for (const s of r.substitutions) out.push([local(s.effectiveAt), s.original ?? "", s.substitute ?? "", labels.reason(s.reasonCode), s.fullReplacement ? labels.yes : labels.no, String(s.uncoveredCount)]);
  out.push([], labels.alerts);
  for (const a of r.coverageAlerts) out.push([local(a.uncoveredFrom), a.resident, a.reason, a.resolvedAt ? labels.yes : labels.no]);
  return out;
}
export function occupancyCsvRows(list: readonly ResidentialEstablishmentSummary[], header: string[], notConfigured: string): string[][] {
  return [header, ...list.map((e) => [e.name, String(e.occupancy.rooms), e.occupancy.capacityConfigured ? String(e.occupancy.bedsRegistered) : notConfigured,
    String(e.occupancy.bedsOccupied), String(e.occupancy.bedsAvailable), String(e.occupancy.activeResidents), String(e.occupancy.residentsWithoutRoom),
    e.occupancy.occupancyPercent === null ? notConfigured : `${e.occupancy.occupancyPercent}%`])];
}

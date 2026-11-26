import i18n from "@/i18n";
import { apiClient } from "./client";
import type { Policy, WeekRow } from "./residentialAttendance";

/**
 * 177 (hogares F5): informes administrativos. Asistencia y horas trabajadas (rango libre de 1 a 31 días, validadas y
 * pendientes por separado; no es nómina) con HOGAR_PONCHES; asignaciones con HOGAR_ASIGNACIONES; la ocupación sale de
 * la lista de establecimientos (F1). Solo administración; el backend decide todo.
 */
export interface ReportTotals {
  shifts: number; validatedMinutes: number; pendingMinutes: number; breakMinutes: number; mealMinutes: number; lateCount: number; lateMinutes: number;
  earlyLeaveCount: number; earlyLeaveMinutes: number; absences: number; openSessions: number;
}
export interface AttendanceReport {
  establishment: { id: string; name: string }; from: string; to: string; days: number; policy: Policy;
  rows: Array<WeekRow & { substitutedPart?: boolean }>; people: Array<ReportTotals & { membershipId: string; workerName: string | null }>; totals: ReportTotals;
}
export interface AssignmentsReport {
  establishment: { id: string; name: string }; from: string; to: string; days: number;
  shifts: Array<{ shiftId: string; scheduledStart: string; scheduledEnd: string; status: string; staff: number; residents: number; periods: number; substitutions: number; coverageAlerts: number }>;
  substitutions: Array<{ shiftId: string; original: string | null; substitute: string | null; effectiveAt: string; fullReplacement: boolean; reasonCode: string; availabilityWarning: boolean; uncoveredCount: number; createdBy: string | null }>;
  coverageAlerts: Array<{ shiftId: string; resident: string; uncoveredFrom: string; reason: string; resolvedAt: string | null }>;
  totals: { shifts: number; cancelled: number; substitutions: number; coverageAlerts: number; openCoverageAlerts: number };
}
const q = (from: string, to: string) => `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
export const reportsApi = {
  attendance: (o: string, l: string, from: string, to: string, t: string) =>
    apiClient.get<{ report: AttendanceReport }>(`/organizations/${o}/residential/attendance/establishments/${l}/report?${q(from, to)}`, t),
  assignments: (o: string, l: string, from: string, to: string, t: string) =>
    apiClient.get<{ report: AssignmentsReport }>(`/organizations/${o}/residential/assignments/establishments/${l}/report?${q(from, to)}`, t),
};

export const REPORT_ERROR_CODES = ["RESIDENTIAL_REPORT_RANGE_INVALID", "RESIDENTIAL_MANAGER_REQUIRED", "RESIDENTIAL_NOT_FOUND", "FEATURE_NOT_ENABLED", "INVALID_INPUT"] as const;
export function reportErrorMessage(error: unknown): string {
  const e = error as { code?: string; isNetworkError?: boolean } | null;
  if (e?.isNetworkError) return i18n.t("residential:reports.errors.network");
  return e?.code && (REPORT_ERROR_CODES as readonly string[]).includes(e.code)
    ? i18n.t(`residential:reports.errors.${e.code as (typeof REPORT_ERROR_CODES)[number]}`)
    : i18n.t("residential:reports.errors.fallback");
}

import i18n from "@/i18n";
import { apiClient } from "./client";

/**
 * 176 (hogares F3): asignación de residentes por turno y sustitución administrativa.
 * Asignaciones: solo hogares y solo con HOGAR_ASIGNACIONES. Sustituciones: además con HOGAR_CALENDARIO (403 si falta uno).
 * El portal no decide nada: los bloqueos, la cobertura y el acceso los calcula el backend; aquí solo se muestran.
 */
export type CloseReason = "ended" | "redistribution" | "substitution" | "transfer" | "resident_inactive";
export type Origin = "assignment" | "redistribution" | "substitution";
export interface BoardPeriod { id: string; membershipId: string; from: string; until: string; closed: boolean; closeReason: CloseReason | null; origin: Origin; activeNow: boolean }
export interface BoardResident { id: string; name: string; roomName: string | null; assignments: BoardPeriod[]; coveredBy: string[]; shared: boolean; uncovered: boolean }
export interface BoardStaff { membershipId: string; name: string | null; role: string | null; coverageStart: string; coverageEnd: string; accepted: boolean; residentCount: number }
export interface ShiftBoard {
  shift: { id: string; establishment: { id: string; name: string }; scheduledStart: string; scheduledEnd: string; status: string; requiredRole: string; ended: boolean };
  staff: BoardStaff[]; residents: BoardResident[]; totals: { residents: number; covered: number; uncovered: number; shared: number };
}
export interface MyResident { shiftId: string; establishment: string; careRecipientId: string; name: string; until: string }
export interface HistoryPeriod { id: string; resident: string; worker: string | null; from: string; until: string | null; origin: Origin; closeReason: CloseReason | null; createdAt: string; createdBy: string | null; closedAt: string | null; closedBy: string | null }
export const SUBSTITUTION_REASONS = ["unplanned_absence", "operational", "schedule_change", "other"] as const;
export type SubstitutionReason = (typeof SUBSTITUTION_REASONS)[number];
export interface HistorySubstitution { id: string; original: string | null; substitute: string | null; effectiveAt: string; fullReplacement: boolean; reasonCode: SubstitutionReason; reasonNote: string | null; availabilityWarning: boolean; uncoveredCount: number; createdAt: string; createdBy: string | null }
export interface CoverageAlert { id: string; shiftId: string; resident: string; location: string; uncoveredFrom: string; reason: string; createdAt: string; resolvedAt: string | null }
export const SUBSTITUTION_BLOCKS = [
  "shift_cancelled", "shift_ended", "original_not_covering", "already_assigned", "substitute_inactive", "not_eligible", "role_mismatch",
  "not_authorized_in_establishment", "schedule_overlap",
] as const;
export type SubstitutionBlock = (typeof SUBSTITUTION_BLOCKS)[number];
export interface SubstitutionPreview { effectiveAt: string; fullReplacement: boolean; blocks: SubstitutionBlock[]; availabilityWarning: boolean; originalResidents: string[] }
export interface Move { careRecipientId: string; fromMembershipId: string; toMembershipId: string | null }
export interface SubstitutionInput {
  originalMembershipId: string; substituteMembershipId: string; effectiveAt?: string; reasonCode: SubstitutionReason; reasonNote?: string;
  confirmAvailability?: boolean; transfers: Array<{ careRecipientId: string; toMembershipId: string }>; confirmUncovered?: boolean; uncoveredReason?: string;
}

const A = (o: string) => `/organizations/${o}/residential/assignments`;
const S = (o: string) => `/organizations/${o}/residential/substitutions`;
export const assignmentsApi = {
  me: (o: string, t: string) => apiClient.get<{ residents: MyResident[] }>(`${A(o)}/me`, t),
  establishments: (o: string, t: string) => apiClient.get<{ establishments: Array<{ id: string; name: string }> }>(`${A(o)}/establishments`, t),
  day: (o: string, l: string, date: string, t: string) => apiClient.get<{ boards: ShiftBoard[] }>(`${A(o)}/establishments/${l}/day?date=${encodeURIComponent(date)}`, t),
  board: (o: string, shiftId: string, t: string) => apiClient.get<{ board: ShiftBoard }>(`${A(o)}/shifts/${shiftId}`, t),
  assign: (o: string, shiftId: string, body: { membershipId: string; careRecipientIds: string[]; effectiveAt?: string }, t: string) =>
    apiClient.post<{ assignment: { assigned: number; effectiveFrom: string } }>(`${A(o)}/shifts/${shiftId}/residents`, body, t),
  redistribute: (o: string, shiftId: string, body: { moves: Move[]; effectiveAt?: string; confirmUncovered?: boolean; uncoveredReason?: string }, t: string) =>
    apiClient.post<{ redistribution: { moved: number; effectiveAt: string; uncovered: string[] } }>(`${A(o)}/shifts/${shiftId}/redistribute`, body, t),
  history: (o: string, shiftId: string, t: string) => apiClient.get<{ history: { periods: HistoryPeriod[]; substitutions: HistorySubstitution[] } }>(`${A(o)}/shifts/${shiftId}/history`, t),
  alerts: (o: string, t: string) => apiClient.get<{ alerts: CoverageAlert[] }>(`${A(o)}/coverage-alerts`, t),
  resolveAlert: (o: string, id: string, t: string) => apiClient.post<{ alert: { id: string; resolved: boolean } }>(`${A(o)}/coverage-alerts/${id}/resolve`, {}, t),
  preview: (o: string, shiftId: string, body: { originalMembershipId: string; substituteMembershipId: string; effectiveAt?: string }, t: string) =>
    apiClient.post<{ preview: SubstitutionPreview }>(`${S(o)}/shifts/${shiftId}/preview`, body, t),
  substitute: (o: string, shiftId: string, body: SubstitutionInput, t: string) =>
    apiClient.post<{ substitution: { id: string; effectiveAt: string; fullReplacement: boolean; transferred: number; uncovered: string[] } }>(`${S(o)}/shifts/${shiftId}`, body, t),
};

/** Códigos con mensaje propio (176); textos en el catálogo «residential» (es/en). */
export const ASSIGNMENT_ERROR_CODES = [
  "RESIDENTIAL_ASSIGNMENT_DUPLICATE", "RESIDENTIAL_ASSIGNMENT_IMMUTABLE", "RESIDENTIAL_ASSIGNMENT_NOT_FOUND", "RESIDENTIAL_ASSIGNMENT_OUTSIDE_COVERAGE",
  "RESIDENTIAL_ASSIGNMENT_RESIDENT_NOT_HERE", "RESIDENTIAL_ASSIGNMENT_RETROACTIVE", "RESIDENTIAL_ASSIGNMENT_SHIFT_CANCELLED", "RESIDENTIAL_ASSIGNMENT_SHIFT_MISMATCH",
  "RESIDENTIAL_ASSIGNMENT_STAFF_NOT_ASSIGNED", "RESIDENTIAL_UNCOVERED_CONFIRMATION_REQUIRED", "RESIDENTIAL_SUBSTITUTION_AVAILABILITY_CONFIRMATION_REQUIRED",
  "RESIDENTIAL_SUBSTITUTION_BLOCKED", "RESIDENTIAL_SUBSTITUTION_NOT_AVAILABLE", "RESIDENTIAL_SUBSTITUTION_RETROACTIVE", "RESIDENTIAL_SUBSTITUTION_SHIFT_MISMATCH",
  "RESIDENTIAL_MANAGER_REQUIRED", "RESIDENTIAL_NOT_FOUND", "FEATURE_NOT_ENABLED", "INVALID_INPUT",
] as const;
export type AssignmentErrorCode = (typeof ASSIGNMENT_ERROR_CODES)[number];
export function assignmentErrorMessage(error: unknown): string {
  const e = error as { code?: string; isNetworkError?: boolean } | null;
  if (e?.isNetworkError) return i18n.t("residential:assignments.errors.network");
  return e?.code && (ASSIGNMENT_ERROR_CODES as readonly string[]).includes(e.code)
    ? i18n.t(`residential:assignments.errors.${e.code as AssignmentErrorCode}`)
    : i18n.t("residential:assignments.errors.fallback");
}

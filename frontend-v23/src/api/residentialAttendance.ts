import i18n from "@/i18n";
import { apiClient } from "./client";

/**
 * 173–175 (hogares F4): ponches con QR o código de 6 dígitos, geocerca, revisión, correcciones y alertas.
 * Solo hogares y solo con HOGAR_PONCHES. El servidor deriva el QR y el código al imprimir y nunca los guarda; el teléfono
 * solo envía la lectura de ubicación del momento del ponche (con consentimiento) y el servidor guarda el estado, no las
 * coordenadas.
 */
export type PunchType = "in" | "out" | "break_start" | "break_end" | "meal_start" | "meal_end";
export type EffectiveStatus = "validated" | "pending_review" | "justified" | "not_recognized";
export type PunchFlag = "declared_in_future" | "before_code" | "outside_shift_window" | "clock_skew" | "impossible_order" | "received_after_72h"
  | "code_invalid" | "transition_not_for_entry" | "no_consent" | "no_geofence_center" | "duplicate_open_session";
export interface Punch {
  id: string; shiftId: string; locationId: string; type: PunchType; origin: "online" | "offline" | "manual";
  declaredAt: string | null; serverReceivedAt: string; effectiveAt: string;
  code: { method: "qr" | "pin" | "none"; status: "current" | "transition" | "invalid" | "none" };
  location: { status: "inside" | "outside" | "low_accuracy" | "unavailable"; distanceM: number | null; accuracyM: number | null };
  validation: { initial: "validated" | "pending_review" | "justified"; effective: EffectiveStatus };
  flags: PunchFlag[]; manualReason: string | null; membershipId: string; workerName?: string | null; locationName?: string | null;
}
export interface MyShift { shiftId: string; establishment: { id: string; name: string }; scheduledStart: string; scheduledEnd: string; openSession: boolean; breakOpen: boolean; mealOpen: boolean }
export interface MyAttendance { shifts: MyShift[]; consent: { currentVersion: string; accepted: boolean; acceptedAt: string | null }; recentPunches: Punch[] }
export interface PunchInput {
  clientEventId: string; shiftId: string; type: PunchType; method: "qr" | "pin"; qr?: string; pin?: string;
  offline?: boolean; declaredAt?: string; deviceNow?: string; location?: { latitude: number; longitude: number; accuracy: number };
}
export interface CodeInfo { weekStart: string; version: number; availableFrom: string; validFrom: string; validUntil: string; transitionHours: number; transitionUntil: string; revokedAt: string | null; revokeReason: string | null; available: boolean }
export interface CodesView {
  establishment: { id: string; name: string }; current: CodeInfo | null; next: CodeInfo | null; transition: CodeInfo | null; versions: CodeInfo[];
  events: Array<{ type: "generated" | "revoked" | "downloaded"; at: string; actorEmail: string | null; weekStart: string; version: number; reason: string | null }>;
}
export interface PrintView { establishment: { id: string; name: string }; code: CodeInfo; qr: string; pin: string }
export interface Correction { id: string; shiftId: string; punchId: string | null; type: PunchType; requestedAt: string; reason: string; status: "pending" | "approved" | "rejected"; decisionReason: string | null; decidedAt: string | null; createdAt: string; workerName?: string | null; locationName?: string; membershipId?: string }
export interface AttendanceAlert { id: string; kind: "outside_perimeter" | "recidivism" | "long_session" | "attempts_blocked"; locationName: string; workerName: string | null; punchId: string | null; createdAt: string; acknowledgedAt: string | null }
export interface Policy { version: number; transitionHours: number; lateToleranceMinutes: number; earlyLeaveToleranceMinutes: number; absenceAfterMinutes: number }
export interface WeekRow { shiftId: string; scheduledStart: string; scheduledEnd: string; membershipId: string; workerName: string | null; firstInAt: string | null; lastOutAt: string | null; lateMinutes: number; earlyLeaveMinutes: number; absent: boolean; openSession: boolean; validatedMinutes: number; pendingMinutes: number; breakMinutes: number; mealMinutes: number }

const base = (o: string) => `/organizations/${o}/residential/attendance`;
export const attendanceApi = {
  me: (o: string, t: string) => apiClient.get<{ attendance: MyAttendance }>(`${base(o)}/me`, t),
  punch: (o: string, body: PunchInput, t: string) => apiClient.post<{ punch: Punch; duplicate: boolean }>(`${base(o)}/me/punch`, body, t),
  consent: (o: string, version: string, accept: boolean, t: string) => apiClient.put<{ consent: { currentVersion: string; accepted: boolean } }>(`${base(o)}/me/consent`, { version, accept }, t),
  requestCorrection: (o: string, body: { shiftId: string; punchId?: string; type: PunchType; requestedAt: string; reason: string }, t: string) =>
    apiClient.post<{ correction: { id: string; status: string } }>(`${base(o)}/me/corrections`, body, t),
  myCorrections: (o: string, t: string) => apiClient.get<{ corrections: Correction[] }>(`${base(o)}/me/corrections`, t),
  establishments: (o: string, t: string) => apiClient.get<{ establishments: Array<{ id: string; name: string }> }>(`${base(o)}/establishments`, t),
  codes: (o: string, l: string, t: string) => apiClient.get<{ codes: CodesView }>(`${base(o)}/establishments/${l}/codes`, t),
  print: (o: string, l: string, weekStart: string, t: string) => apiClient.post<{ print: PrintView }>(`${base(o)}/establishments/${l}/codes/print`, { weekStart }, t),
  revoke: (o: string, l: string, weekStart: string, reason: string, t: string) => apiClient.post<{ revocation: { newVersion: number } }>(`${base(o)}/establishments/${l}/codes/revoke`, { weekStart, reason }, t),
  policy: (o: string, l: string, t: string) => apiClient.get<{ policy: Policy }>(`${base(o)}/establishments/${l}/policy`, t),
  updatePolicy: (o: string, l: string, body: Omit<Policy, "version"> & { reason: string }, t: string) => apiClient.put<{ policy: Policy }>(`${base(o)}/establishments/${l}/policy`, body, t),
  week: (o: string, l: string, w: string, t: string) => apiClient.get<{ week: { establishment: { id: string; name: string }; weekStart: string; policy: Policy; rows: WeekRow[] } }>(`${base(o)}/establishments/${l}/weeks/${w}`, t),
  punches: (o: string, params: { locationId?: string; status?: EffectiveStatus }, t: string) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]).toString();
    return apiClient.get<{ result: { punches: Punch[]; pendingTotal: number } }>(`${base(o)}/punches${q ? `?${q}` : ""}`, t);
  },
  punchHistory: (o: string, id: string, t: string) => apiClient.get<{ history: { punch: Punch; reviews: Array<{ decision: EffectiveStatus; reason: string; at: string; reviewerEmail: string | null; batchId: string | null }> } }>(`${base(o)}/punches/${id}`, t),
  review: (o: string, punchIds: string[], decision: Exclude<EffectiveStatus, "pending_review">, reason: string, t: string) =>
    apiClient.post<{ review: { reviewed: number } }>(`${base(o)}/punches/review`, { punchIds, decision, reason }, t),
  corrections: (o: string, t: string) => apiClient.get<{ corrections: Correction[] }>(`${base(o)}/corrections`, t),
  decide: (o: string, id: string, approve: boolean, reason: string, t: string) => apiClient.post<{ correction: { status: string } }>(`${base(o)}/corrections/${id}/decision`, { approve, reason }, t),
  alerts: (o: string, t: string) => apiClient.get<{ alerts: AttendanceAlert[] }>(`${base(o)}/alerts`, t),
  acknowledge: (o: string, id: string, t: string) => apiClient.post<{ alert: { acknowledged: boolean } }>(`${base(o)}/alerts/${id}/acknowledge`, {}, t),
};

/** Códigos con mensaje propio (173–175); textos en el catálogo «residential» (es/en). */
export const ATTENDANCE_ERROR_CODES = [
  "ATTENDANCE_UNAVAILABLE", "ATTENDANCE_NOT_AUTHORIZED", "ATTENDANCE_DUPLICATE_EVENT", "ATTENDANCE_TOO_MANY_ATTEMPTS", "ATTENDANCE_CODE_NOT_AVAILABLE", "ATTENDANCE_CODE_KEY_RETIRED",
  "ATTENDANCE_DOWNLOAD_LIMIT", "ATTENDANCE_SELF_REVIEW", "ATTENDANCE_ALREADY_DECIDED", "ATTENDANCE_IMMUTABLE", "RESIDENTIAL_ESTABLISHMENT_CLOSED",
  "RESIDENTIAL_MANAGER_REQUIRED", "RESIDENTIAL_NOT_FOUND", "FEATURE_NOT_ENABLED", "INVALID_INPUT",
] as const;
export type AttendanceErrorCode = (typeof ATTENDANCE_ERROR_CODES)[number];
export function attendanceErrorMessage(error: unknown): string {
  const e = error as { code?: string; isNetworkError?: boolean } | null;
  if (e?.isNetworkError) return i18n.t("residential:attendance.errors.network");
  return e?.code && (ATTENDANCE_ERROR_CODES as readonly string[]).includes(e.code)
    ? i18n.t(`residential:attendance.errors.${e.code as AttendanceErrorCode}`)
    : i18n.t("residential:attendance.errors.fallback");
}

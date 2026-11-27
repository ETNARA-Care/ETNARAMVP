import i18n from "@/i18n";
import { apiClient } from "./client";

/**
 * 172 (hogares F2): calendario semanal del establecimiento. Solo hogares, solo con HOGAR_CALENDARIO encendido y solo
 * administración del hogar. En borrador las entradas no son turnos y el personal no las ve; al publicar se crean los
 * turnos reales con las reglas de asignación de siempre. El backend nunca envía la habitación técnica.
 * Fechas y horas: siempre LOCALES de Puerto Rico («2026-12-07T23:00»), sin zona.
 */
export interface ScheduleEstablishment { id: string; name: string }
export interface ScheduleEntry {
  id: string; startsAt: string; endsAt: string; durationMinutes: number; requiredRole: string;
  membershipId: string | null; workerName: string | null; label: string | null;
  published: boolean; removed: boolean; shiftStatus: string | null; assignmentStatus: "pending" | "accepted" | null;
}
export interface ScheduleStaff { membershipId: string; name: string | null; role: string | null; eligibility: string }
/** shiftIds: turnos individuales (de «Turnos») implicados en el aviso, además de las entradas del calendario. */
export interface ScheduleWarning { type: "duplicate" | "overlap"; membershipId: string; entryIds: string[]; shiftIds?: string[] }
/**
 * 27-nov: turno individual del establecimiento (creado desde «Turnos», no desde el calendario). Solo lectura en la
 * semana: cuenta en las horas y en los avisos. Se edita en «Turnos».
 */
export interface ScheduleIndividualShift {
  shiftId: string; startsAt: string; endsAt: string; durationMinutes: number;
  target: "establishment" | "room" | "resident"; roomName: string | null; residentName: string | null; requiredRole: string;
  membershipId: string | null; workerName: string | null; assignmentStatus: "pending" | "accepted" | null; shiftStatus: string;
}
export interface ScheduleWeek {
  establishment: ScheduleEstablishment;
  week: { weekStart: string; status: "empty" | "draft" | "published"; version: number; hasUnpublishedChanges: boolean; publishedAt: string | null };
  entries: ScheduleEntry[];
  individualShifts?: ScheduleIndividualShift[];
  staff: ScheduleStaff[];
  summary: { totalMinutes: number; unassignedEntries: number; byWorker: Array<{ membershipId: string; minutes: number }>; byDay: Array<{ date: string; minutes: number }> };
  warnings: ScheduleWarning[];
}
export interface SchedulePublication { version: number; publishedAt: string; actorEmail: string | null; shiftsCreated: number; shiftsCancelled: number; shiftCount: number }
export interface ScheduleSlot { weekday: number; startTime: string; durationMinutes: number; requiredRole: string; headcount: number; label: string | null }
export interface ScheduleTemplate { id: string; name: string; archived: boolean; slots: ScheduleSlot[] }
export interface ScheduleEntryInput { startsAt: string; durationMinutes: number; requiredRole?: string; membershipId?: string | null; label?: string | null }

/**
 * 27-nov: «Mi horario» del cuidador. Solo sus propios turnos de la semana (del calendario publicado o de «Turnos»);
 * nunca borradores ni compañeros. Fechas locales de Puerto Rico.
 */
export interface MyScheduleShift {
  shiftId: string; startsAt: string; endsAt: string; durationMinutes: number; status: string; assignmentStatus: "pending" | "accepted";
  establishmentName: string | null; roomName: string | null; residentName: string | null;
}
export interface MyScheduleWeek {
  weekStart: string; weekEnd: string; totalMinutes: number;
  days: Array<{ date: string; minutes: number; shiftIds: string[] }>;
  shifts: MyScheduleShift[];
}

const base = (o: string) => `/organizations/${o}/residential/schedule`;
const week = (o: string, locationId: string, weekStart: string) => `${base(o)}/establishments/${locationId}/weeks/${weekStart}`;
export const scheduleApi = {
  establishments: (o: string, t: string) => apiClient.get<{ establishments: ScheduleEstablishment[] }>(`${base(o)}/establishments`, t),
  mine: (o: string, w: string, t: string) => apiClient.get<{ schedule: MyScheduleWeek }>(`${base(o)}/me/weeks/${w}`, t),
  week: (o: string, l: string, w: string, t: string) => apiClient.get<{ schedule: ScheduleWeek }>(week(o, l, w), t),
  createEntry: (o: string, l: string, w: string, body: ScheduleEntryInput, t: string) => apiClient.post<{ entry: { id: string } }>(`${week(o, l, w)}/entries`, body, t),
  updateEntry: (o: string, entryId: string, body: Partial<ScheduleEntryInput>, t: string) => apiClient.patch<{ entry: { id: string; replaced: boolean } }>(`${base(o)}/entries/${entryId}`, body, t),
  removeEntry: (o: string, entryId: string, t: string) => apiClient.delete<{ entry: { id: string; removed: boolean } }>(`${base(o)}/entries/${entryId}`, t),
  copyWeek: (o: string, l: string, w: string, fromWeekStart: string, t: string) => apiClient.post<{ copy: { copied: number } }>(`${week(o, l, w)}/copy`, { fromWeekStart }, t),
  applyTemplate: (o: string, l: string, w: string, templateId: string, t: string) => apiClient.post<{ applied: { added: number } }>(`${week(o, l, w)}/apply-template`, { templateId }, t),
  publish: (o: string, l: string, w: string, t: string) =>
    apiClient.post<{ publication: { version: number; shiftsCreated: number; shiftsCancelled: number; shiftCount: number; notified: number } }>(`${week(o, l, w)}/publish`, {}, t),
  publications: (o: string, l: string, w: string, t: string) => apiClient.get<{ publications: SchedulePublication[] }>(`${week(o, l, w)}/publications`, t),
  templates: (o: string, l: string, t: string) => apiClient.get<{ templates: ScheduleTemplate[] }>(`${base(o)}/establishments/${l}/templates`, t),
  createTemplate: (o: string, l: string, body: { name: string; slots: Array<Omit<ScheduleSlot, "label"> & { label?: string | null }> }, t: string) =>
    apiClient.post<{ template: ScheduleTemplate }>(`${base(o)}/establishments/${l}/templates`, body, t),
  updateTemplate: (o: string, templateId: string, body: { name?: string; archived?: boolean }, t: string) => apiClient.patch<{ template: ScheduleTemplate }>(`${base(o)}/templates/${templateId}`, body, t),
};

/** Códigos con mensaje propio (172); los textos están en el catálogo «residential» (es/en). */
export const SCHEDULE_ERROR_CODES = [
  "RESIDENTIAL_ESTABLISHMENT_CLOSED",
  "RESIDENTIAL_SCHEDULE_IN_PAST",
  "RESIDENTIAL_SCHEDULE_NOTHING_TO_PUBLISH",
  "RESIDENTIAL_SCHEDULE_OVERLAP",
  "RESIDENTIAL_SCHEDULE_PUBLISHED_ENTRY",
  "RESIDENTIAL_SCHEDULE_SHIFT_STARTED",
  "RESIDENTIAL_SCHEDULE_STAFF_NOT_ACTIVE",
  "RESIDENTIAL_SCHEDULE_STAFF_NOT_ELIGIBLE",
  "RESIDENTIAL_SCHEDULE_STAFF_CONFLICT",
  "RESIDENTIAL_SCHEDULE_TEMPLATE_ARCHIVED",
  "RESIDENTIAL_SCHEDULE_WEEK_NOT_EMPTY",
  "RESIDENTIAL_SCHEDULE_WEEK_START_INVALID",
  "RESIDENTIAL_SCHEDULE_OUTSIDE_WEEK",
  "RESIDENTIAL_SCHEDULE_IMMUTABLE",
  "RESIDENTIAL_MANAGER_REQUIRED",
  "FEATURE_NOT_ENABLED",
  "INVALID_INPUT",
] as const;
export type ScheduleErrorCode = (typeof SCHEDULE_ERROR_CODES)[number];
export function scheduleErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  return code && (SCHEDULE_ERROR_CODES as readonly string[]).includes(code)
    ? i18n.t(`residential:schedule.errors.${code as ScheduleErrorCode}`)
    : i18n.t("residential:schedule.errors.fallback");
}

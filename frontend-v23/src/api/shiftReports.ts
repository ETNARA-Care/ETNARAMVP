import { apiClient } from "./client";

/**
 * Informe de Turno F1 (backend migration 124). Agency managers only, and only
 * while ETNARA central has SHIFT_REPORTS on for the agency (404 otherwise).
 * The content is a snapshot of the shift's real records: nothing is invented and
 * free text arrives exactly as the caregiver wrote it.
 */
export type ShiftReportStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "APPROVED" | "SUPERSEDED";
export type FamilySectionKey = "schedule" | "meals" | "hydration" | "activities" | "mobility" | "observations" | "hygiene" | "mood" | "incidents" | "photos";
export type FamilySections = Record<FamilySectionKey, boolean>;

interface Item { careEventId: string; at: string; note: string | null }
export interface ShiftReportContent {
  schema: 1;
  organization: { name: string };
  recipient: { id: string; name: string };
  caregiver: { membershipId: string; name: string | null };
  shift: { id: string; scheduledStart: string; scheduledEnd: string };
  times: {
    arrival: { at: string; proximity: string; recordedOffline: boolean; needsReview: boolean; reviewed: boolean } | null;
    start: { at: string; recordedOffline: boolean };
    end: { at: string; recordedOffline: boolean };
  };
  sections: {
    meals: Array<Item & { mealType: string | null; amountConsumed: string | null }>;
    hydration: Array<Item & { amount: string | null }>;
    hygiene: Array<Item & { result: string | null }>;
    mobility: Array<Item & { activity: string | null }>;
    activities: Array<Item & { label: string | null; durationMinutes: number | null }>;
    mood: Array<Item & { mood: string | null }>;
    notes: Array<{ careEventId: string; at: string; text: string | null }>;
  };
  incidents: Array<{ incidentId: string; at: string; severity: string; status: string; description: string | null }>;
  observations: Array<{ observationId: string; at: string; category: string; status: string; description: string | null }>;
  photos: { count: number; photoEvents: number };
  totals: { careEvents: number; incidents: number; observations: number };
}
export interface ShiftReportHistoryEntry { type: string; at: string; actor: { userId: string; email: string | null } | null; note: string | null }
export interface ShiftReport {
  id: string; shiftId: string; membershipId: string; careRecipientId: string; version: number; status: ShiftReportStatus;
  content: ShiftReportContent; familySections: FamilySections | null; agencySummary: string | null;
  generatedAt: string; approvedAt: string | null; approvedBy: { userId: string; email: string | null } | null;
  history?: ShiftReportHistoryEntry[];
}
export interface ShiftReportListItem {
  id: string; shiftId: string; status: ShiftReportStatus; version: number; generatedAt: string; approvedAt: string | null;
  recipientName: string | null; caregiverName: string | null; scheduledStart: string | null; scheduledEnd: string | null;
  totals: ShiftReportContent["totals"] | null;
}

/** ETNARA's defaults for what the family sees once approved (25-oct-2026). */
export const FAMILY_SECTION_DEFAULTS: FamilySections = {
  schedule: true, meals: true, hydration: true, activities: true, mobility: true, observations: true,
  hygiene: false, mood: false, incidents: false, photos: false,
};

const O = (org: string) => `/organizations/${org}`;
export const shiftReportsApi = {
  list: (org: string, token: string, status?: "DRAFT" | "APPROVED") =>
    apiClient.get<{ reports: ShiftReportListItem[] }>(`${O(org)}/shift-reports${status ? `?status=${status}` : ""}`, token),
  forShift: (org: string, shiftId: string, token: string) =>
    apiClient.get<{ reports: ShiftReport[]; finishedVisits: number; openVisits: number }>(`${O(org)}/shifts/${shiftId}/reports`, token),
  refresh: (org: string, reportId: string, token: string) =>
    apiClient.post<{ report: ShiftReport }>(`${O(org)}/shift-reports/${reportId}/refresh`, {}, token),
  approve: (org: string, reportId: string, body: { expectedGeneratedAt: string; familySections: Partial<FamilySections>; agencySummary?: string }, token: string) =>
    apiClient.post<{ report: ShiftReport }>(`${O(org)}/shift-reports/${reportId}/approve`, body, token),
};

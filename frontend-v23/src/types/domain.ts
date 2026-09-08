/**
 * Tipos base reflejando las capacidades reales confirmadas en Fase 1
 * (backend etnara-care-backend-staging). NO son contratos inventados --
 * los nombres de campo siguen el shape que devuelven los endpoints reales
 * documentados (GET /me, /organizations/:id/..., etc). Se amplían en Fase 3
 * cuando se integre cada endpoint uno por uno.
 */

export type ExperienceKind = "family" | "caregiver" | "agency";

export type OrganizationRole = "owner" | "admin" | "scheduler" | "caregiver" | "family";

export interface OrganizationMembership {
  id: string;
  name: string;
  type: string;
  membershipStatus: string;
  roles: string[];
}

export interface CurrentUser {
  id: string;
  email: string | null;
  phone: string | null;
}

export type ShiftStatus = "unassigned" | "assigned" | "in_progress" | "completed" | "cancelled";

export interface ShiftSummary {
  id: string;
  careRecipientName: string;
  start: string;
  end: string;
  status: ShiftStatus;
  location?: string;
}

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "in_progress" | "resolved";

export interface IncidentSummary {
  id: string;
  type: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  careRecipientName: string;
  reportedAt: string;
}

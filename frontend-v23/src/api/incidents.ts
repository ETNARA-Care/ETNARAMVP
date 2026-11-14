import { apiClient } from "./client";

export interface Incident {
  id: string;
  organization_id: string;
  care_recipient_id: string;
  organization_worker_membership_id: string;
  escalated_from_observation_id: string | null;
  severity: string;
  description: string;
  actions_taken: string | null;
  assigned_to_user_id: string | null;
  resolution: string | null;
  status: string;
  created_at: string;
  /** 154: who resolved it and when (null for incidents resolved before 154). */
  resolved_by_user_id?: string | null;
  resolved_at?: string | null;
}

export interface FamilyIncident {
  id: string;
  careRecipientId: string;
  severity: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface IncidentTimelineEntry {
  id: string;
  incident_id: string;
  entry_text: string;
  occurred_at: string;
}

export async function createIncident(
  organizationId: string,
  input: { careRecipientId: string; severity: string; description: string; actionsTaken?: string },
  token: string,
): Promise<Incident> {
  const result = await apiClient.post<{ incident: Incident }>(
    `/organizations/${organizationId}/incidents`,
    input,
    token,
  );
  return result.incident;
}

export async function listIncidents(organizationId: string, token: string, status?: "resolved"): Promise<Incident[]> {
  const result = await apiClient.get<{ incidents: Incident[] }>(
    `/organizations/${organizationId}/incidents${status ? `?status=${status}` : ""}`,
    token,
  );
  return result.incidents;
}

export async function getIncident(organizationId: string, incidentId: string, token: string): Promise<Incident> {
  const result = await apiClient.get<{ incident: Incident }>(
    `/organizations/${organizationId}/incidents/${incidentId}`,
    token,
  );
  return result.incident;
}

export async function listIncidentTimeline(
  organizationId: string,
  incidentId: string,
  token: string,
): Promise<IncidentTimelineEntry[]> {
  const result = await apiClient.get<{ entries: IncidentTimelineEntry[] }>(
    `/organizations/${organizationId}/incidents/${incidentId}/timeline`,
    token,
  );
  return result.entries;
}

/** Contrato deliberadamente filtrado por el backend para el portal familiar. */
export async function listFamilyIncidents(
  organizationId: string,
  careRecipientId: string,
  token: string,
): Promise<FamilyIncident[]> {
  const result = await apiClient.get<{ incidents: FamilyIncident[] }>(
    `/organizations/${organizationId}/care-recipients/${careRecipientId}/family-incidents`,
    token,
  );
  return result.incidents;
}

// --- 154: resolución de incidentes -------------------------------------------------------------

export interface IncidentResolutionRules {
  serious: boolean;
  canManage: boolean;
  canCloseSerious: boolean;
  hasDocumentedFollowUp: boolean;
  minResolutionLength: number;
  resolvedByEmail: string | null;
}

export async function getIncidentResolutionRules(organizationId: string, incidentId: string, token: string): Promise<IncidentResolutionRules> {
  const result = await apiClient.get<{ rules: IncidentResolutionRules }>(
    `/organizations/${organizationId}/incidents/${incidentId}/resolution-rules`, token);
  return result.rules;
}

export async function updateIncidentStatus(
  organizationId: string, incidentId: string, input: { status: "in_progress" | "resolved"; resolution?: string }, token: string,
): Promise<Incident> {
  const result = await apiClient.post<{ incident: Incident }>(`/organizations/${organizationId}/incidents/${incidentId}/status`, input, token);
  return result.incident;
}

export const FOLLOW_UP_NOTE_MIN = 20;

export async function addIncidentTimelineEntry(organizationId: string, incidentId: string, entryText: string, token: string) {
  return apiClient.post(`/organizations/${organizationId}/incidents/${incidentId}/timeline`, { entryText }, token);
}

export interface IncidentCloser { membershipId: string; email: string; authorized: boolean; grantedAt: string | null; grantedBy: string | null }
export const incidentClosersApi = {
  list: (organizationId: string, token: string) =>
    apiClient.get<{ supervisors: IncidentCloser[] }>(`/organizations/${organizationId}/incident-closers`, token),
  grant: (organizationId: string, membershipId: string, token: string) =>
    apiClient.post(`/organizations/${organizationId}/incident-closers`, { membershipId }, token),
  revoke: (organizationId: string, membershipId: string, token: string) =>
    apiClient.post(`/organizations/${organizationId}/incident-closers/${membershipId}/revoke`, {}, token),
};

export function incidentErrorMessage(code: string | undefined): string {
  switch (code) {
    case "INCIDENT_SERIOUS_CLOSER_REQUIRED": return "Un incidente grave solo lo cierra una administradora o una supervisora autorizada por la agencia.";
    case "INCIDENT_SERIOUS_FOLLOW_UP_REQUIRED": return "Antes de cerrarlo: ponlo en seguimiento y documenta al menos una nota de seguimiento.";
    case "INCIDENT_RESOLUTION_TOO_SHORT": return "La resolución es demasiado breve: describe qué se hizo.";
    case "INVALID_STATUS_TRANSITION":
    case "INCIDENT_STATUS_TRANSITION_INVALID":
    case "INCIDENT_RESOLVED_IS_FINAL": return "Este incidente ya cambió de estado. Actualiza la página.";
    case "REQUIRES_ORG_MANAGER":
    case "INCIDENT_STATUS_FORBIDDEN": return "Solo la administración o supervisión de la agencia puede hacerlo.";
    default: return "No se pudo guardar. Intenta nuevamente.";
  }
}

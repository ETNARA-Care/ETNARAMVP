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

export async function listIncidents(organizationId: string, token: string): Promise<Incident[]> {
  const result = await apiClient.get<{ incidents: Incident[] }>(
    `/organizations/${organizationId}/incidents`,
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

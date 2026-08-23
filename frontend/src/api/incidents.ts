import { apiFetch } from "./client";

export type IncidentStatus = "open" | "in_progress" | "resolved";

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
  status: IncidentStatus;
  created_at: string;
}

export interface CreateIncidentInput {
  careRecipientId: string;
  // severity es texto libre en el backend real (columna `text NOT NULL`,
  // no un enum) -- no se inventa aquí un catálogo cerrado que el backend
  // no tiene. La UI puede sugerir opciones, pero el valor viaja tal cual.
  severity: string;
  description: string;
  actionsTaken?: string;
}

export async function createIncident(organizationId: string, input: CreateIncidentInput): Promise<Incident> {
  const res = await apiFetch<{ incident: Incident }>(`/organizations/${organizationId}/incidents`, {
    method: "POST",
    body: input,
  });
  return res.incident;
}

export async function listIncidents(
  organizationId: string,
  filter: { careRecipientId?: string; status?: string } = {}
): Promise<Incident[]> {
  const res = await apiFetch<{ incidents: Incident[] }>(`/organizations/${organizationId}/incidents`, {
    query: filter,
  });
  return res.incidents;
}

export async function getIncident(organizationId: string, incidentId: string): Promise<Incident> {
  const res = await apiFetch<{ incident: Incident }>(`/organizations/${organizationId}/incidents/${incidentId}`);
  return res.incident;
}

export interface IncidentTimelineEntry {
  id: string;
  organization_id: string;
  incident_id: string;
  entry_text: string;
  created_by_user_id: string | null;
  occurred_at: string;
}

export async function listIncidentTimeline(organizationId: string, incidentId: string): Promise<IncidentTimelineEntry[]> {
  const res = await apiFetch<{ entries: IncidentTimelineEntry[] }>(
    `/organizations/${organizationId}/incidents/${incidentId}/timeline`
  );
  return res.entries;
}

export async function addIncidentTimelineEntry(
  organizationId: string,
  incidentId: string,
  entryText: string
): Promise<IncidentTimelineEntry> {
  const res = await apiFetch<{ entry: IncidentTimelineEntry }>(
    `/organizations/${organizationId}/incidents/${incidentId}/timeline`,
    { method: "POST", body: { entryText } }
  );
  return res.entry;
}

// NOTA: cambiar estado (POST .../status), asignar responsable
// (POST .../assign) y escalar una Observation (POST .../:id/escalate)
// requieren autoridad de manager en el backend real -- deliberadamente no
// se exponen aquí, porque el Caregiver nunca debe ver esos controles.
// Los adjuntos (POST .../attachments) requieren un storedFileId real, y no
// existe endpoint de upload en el backend -- tampoco se exponen aquí.

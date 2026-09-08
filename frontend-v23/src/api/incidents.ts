import { apiClient } from "./client";

export interface Incident {
  id: string;
  care_recipient_id: string;
  severity: string;
  description: string;
  actions_taken: string | null;
  status: string;
  created_at: string;
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

import { apiClient } from "./client";

export interface Establishment {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface EstablishmentInput {
  name: string;
  address?: string;
}

export function listEstablishments(organizationId: string, token: string): Promise<{ establishments: Establishment[] }> {
  return apiClient.get(`/organizations/${organizationId}/establishments`, token);
}

export function createEstablishment(organizationId: string, input: EstablishmentInput, token: string): Promise<{ establishment: Establishment }> {
  return apiClient.post(`/organizations/${organizationId}/establishments`, input, token);
}

export function updateEstablishment(
  organizationId: string,
  establishmentId: string,
  input: Partial<EstablishmentInput> & { status?: Establishment["status"] },
  token: string,
): Promise<{ establishment: Establishment }> {
  return apiClient.patch(`/organizations/${organizationId}/establishments/${establishmentId}`, input, token);
}

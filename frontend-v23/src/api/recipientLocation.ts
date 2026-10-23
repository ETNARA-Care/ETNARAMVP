import { apiClient, type ApiError } from "./client";

/** Dirección de visita del residente (backend fase 12.1, tabla care_recipient_locations). */
export interface RecipientLocation {
  care_recipient_id: string;
  address_line: string | null;
  municipality: string | null;
  access_notes: string | null;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
}

export interface SaveRecipientLocationInput {
  addressLine: string | null;
  municipality: string | null;
  accessNotes: string | null;
  latitude: number | null;
  longitude: number | null;
}

const locationPath = (organizationId: string, recipientId: string) =>
  `/organizations/${organizationId}/care-recipients/${recipientId}/location`;

/**
 * Devuelve la dirección o null. Un 404 significa que no hay acceso
 * (por ejemplo, el turno ya terminó): se trata como "sin dirección", no como error.
 */
export async function getRecipientLocation(organizationId: string, recipientId: string, token: string): Promise<RecipientLocation | null> {
  try {
    const result = await apiClient.get<{ location: RecipientLocation | null }>(locationPath(organizationId, recipientId), token);
    return result.location;
  } catch (error) {
    if ((error as ApiError).status === 404) return null;
    throw error;
  }
}

/** Solo administración y supervisión. El backend responde 403 a cualquier otro rol. */
export async function saveRecipientLocation(organizationId: string, recipientId: string, input: SaveRecipientLocationInput, token: string): Promise<RecipientLocation> {
  const result = await apiClient.put<{ location: RecipientLocation }>(locationPath(organizationId, recipientId), input, token);
  return result.location;
}

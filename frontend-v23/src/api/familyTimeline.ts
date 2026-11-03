import { apiClient } from "./client";

export interface FamilyRecipient {
  organizationId: string;
  recipientId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
}

export interface FamilyTimelineItem {
  id: string;
  type: string;
  occurredAt: string;
  title: string;
  summary: string;
  caregiver: { displayName: string | null; role: string | null };
  /**
   * Fotos de actividades (115/116): `reference` solo llega si la foto está compartida
   * para esta familia ahora mismo (aprobada, consentimientos vigentes, can_view_photos,
   * interruptor encendido). Sin `reference`, no hay nada que mostrar.
   */
  /** availableUntil (v2): fin del plazo de conservación; después nadie la ve. */
  photo?: { visible: boolean; reference?: string; availableUntil?: string };
}

export async function listMyCareRecipients(token: string): Promise<FamilyRecipient[]> {
  const result = await apiClient.get<{ recipients: FamilyRecipient[] }>("/me/care-recipients", token);
  return result.recipients;
}

export async function getFamilyTimeline(
  organizationId: string,
  recipientId: string,
  token: string,
): Promise<FamilyTimelineItem[]> {
  const result = await apiClient.get<{ items: FamilyTimelineItem[]; nextCursor: string | null }>(
    `/organizations/${organizationId}/care-recipients/${recipientId}/timeline?limit=50`,
    token,
  );
  return result.items;
}

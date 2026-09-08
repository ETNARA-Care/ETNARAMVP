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

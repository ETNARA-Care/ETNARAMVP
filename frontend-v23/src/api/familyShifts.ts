import { apiClient } from "./client";

export interface FamilyCredentialSummary {
  typeCode: string;
  typeName: string;
  expiresAt: string | null;
}

export interface FamilyShiftSummary {
  id: string;
  careRecipientId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  caregiver: {
    displayName: string;
    credentials: FamilyCredentialSummary[];
  } | null;
}

export async function listFamilyShifts(
  organizationId: string,
  recipientId: string,
  token: string,
): Promise<FamilyShiftSummary[]> {
  const result = await apiClient.get<{ shifts: FamilyShiftSummary[] }>(
    `/organizations/${organizationId}/care-recipients/${recipientId}/family-shifts`,
    token,
  );
  return result.shifts;
}

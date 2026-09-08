import { apiClient } from "./client";

export interface CredentialSummary {
  id: string;
  typeCode: string;
  typeName: string;
  status: string;
  expiresAt: string | null;
  verificationStatus: "verified" | "pending" | "rejected";
}

export async function listMyCredentials(organizationId: string, token: string): Promise<CredentialSummary[]> {
  const result = await apiClient.get<{ credentials: CredentialSummary[] }>(
    `/organizations/${organizationId}/me/credentials`,
    token,
  );
  return result.credentials;
}

import { apiClient } from "./client";

export type PlatformVerificationStatus = "pending" | "verified" | "rejected";

export interface PlatformCredentialQueueItem {
  credential_id: string;
  worker_id: string;
  worker_name: string;
  credential_type_code: string;
  credential_type_name: string;
  issuing_entity_name: string | null;
  issued_at: string | null;
  expires_at: string | null;
  credential_status: string;
  file_id: string;
  original_filename: string;
  content_type: string;
  uploaded_at: string;
  verification_status: PlatformVerificationStatus;
  verified_at: string | null;
  verification_notes: string | null;
  organization_names: string[];
}

export async function listPlatformCredentialQueue(token: string) {
  const result = await apiClient.get<{ credentials: PlatformCredentialQueueItem[] }>(
    "/platform/credentials/verification-queue",
    token,
  );
  return result.credentials;
}

export async function verifyPlatformCredential(
  credentialId: string,
  status: "verified" | "rejected",
  notes: string,
  token: string,
) {
  const result = await apiClient.post<{ verification: { id: string; status: string } }>(
    `/platform/credentials/${credentialId}/verifications`,
    { status, ...(notes.trim() ? { notes: notes.trim() } : {}) },
    token,
  );
  return result.verification;
}

export async function openPlatformCredentialDocument(
  credentialId: string,
  fileId: string,
  token: string,
) {
  const result = await apiClient.post<{ download: { downloadUrl: string; expiresInSeconds: number } }>(
    `/platform/credentials/${credentialId}/documents/${fileId}/download-url`,
    {},
    token,
  );
  return result.download.downloadUrl;
}

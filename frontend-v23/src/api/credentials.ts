import { apiClient } from "./client";

export interface CredentialSummary {
  id: string;
  typeCode: string;
  typeName: string;
  status: string;
  expiresAt: string | null;
  verificationStatus: "verified" | "pending" | "rejected";
  reviewNotes: string | null;
}

export async function listMyCredentials(organizationId: string, token: string): Promise<CredentialSummary[]> {
  const result = await apiClient.get<{ credentials: CredentialSummary[] }>(
    `/organizations/${organizationId}/me/credentials`,
    token,
  );
  return result.credentials;
}

export async function uploadMyCredentialDocument(
  organizationId: string,
  credentialId: string,
  file: File,
  token: string,
) {
  const initiated = await apiClient.post<{ upload: { fileId: string } }>(
    `/organizations/${organizationId}/me/credentials/${credentialId}/documents/upload-url`,
    { originalFilename: file.name, contentType: file.type, sizeBytes: file.size },
    token,
  );
  await apiClient.postBinary<{ upload: { fileId: string } }>(
    `/organizations/${organizationId}/me/credentials/${credentialId}/documents/${initiated.upload.fileId}/content`,
    file,
    file.type,
    token,
  );
  const completed = await apiClient.post<{ document: { documentId: string; fileId: string; version: number; status: string } }>(
    `/organizations/${organizationId}/me/credentials/${credentialId}/documents/${initiated.upload.fileId}/complete`,
    {},
    token,
  );
  return completed.document;
}

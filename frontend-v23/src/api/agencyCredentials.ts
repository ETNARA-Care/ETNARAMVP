import { apiClient } from "./client";

export interface CredentialTypeCatalogItem {
  code: string;
  name: string;
}

export interface WorkerCredential {
  id: string;
  worker_id: string;
  credential_type_id: string;
  document_id: string | null;
  issuing_entity_name: string | null;
  issuing_entity_type: "government" | "external_provider" | "platform";
  issued_at: string | null;
  expires_at: string | null;
  status: "active" | "expired" | "revoked";
  created_at: string;
  updated_at: string;
  type_code: string;
  document_status: "presented" | "verified" | "rejected" | null;
  organization_review_status: "pending" | "approved" | "rejected" | null;
  organization_review_notes: string | null;
}

export interface CredentialDocumentVersion {
  file_id: string;
  version: number;
  original_filename: string;
  content_type: "application/pdf" | "image/jpeg" | "image/png";
  size_bytes: string;
  created_at: string;
  is_current: boolean;
  review_status: "pending" | "approved" | "rejected" | null;
  review_notes: string | null;
  reviewed_at: string | null;
}

export interface CreateWorkerCredentialInput {
  credentialTypeCode: string;
  issuingEntityName?: string;
  issuingEntityType: "government" | "external_provider" | "platform";
  issuedAt?: string;
  expiresAt?: string;
}

export interface UpdateWorkerCredentialInput {
  issuingEntityName?: string;
  issuingEntityType?: "government" | "external_provider" | "platform";
  issuedAt?: string | null;
  expiresAt?: string | null;
  status?: "active" | "expired" | "revoked";
}

export async function listCredentialTypes(organizationId: string, token: string) {
  const result = await apiClient.get<{ credentialTypes: CredentialTypeCatalogItem[] }>(
    `/organizations/${organizationId}/credential-types`, token,
  );
  return result.credentialTypes;
}

export async function listWorkerCredentials(organizationId: string, workerId: string, token: string) {
  const result = await apiClient.get<{ credentials: WorkerCredential[] }>(
    `/organizations/${organizationId}/workers/${workerId}/credentials`, token,
  );
  return result.credentials;
}

export async function createWorkerCredential(
  organizationId: string,
  workerId: string,
  input: CreateWorkerCredentialInput,
  token: string,
) {
  const result = await apiClient.post<{ credential: WorkerCredential }>(
    `/organizations/${organizationId}/workers/${workerId}/credentials`, input, token,
  );
  return result.credential;
}

export async function updateWorkerCredential(
  organizationId: string,
  workerId: string,
  credentialId: string,
  input: UpdateWorkerCredentialInput,
  token: string,
) {
  const result = await apiClient.patch<{ credential: WorkerCredential }>(
    `/organizations/${organizationId}/workers/${workerId}/credentials/${credentialId}`, input, token,
  );
  return result.credential;
}

export async function uploadCredentialDocument(
  organizationId: string,
  workerId: string,
  credentialId: string,
  file: File,
  token: string,
) {
  const initiated = await apiClient.post<{ upload: { fileId: string; uploadUrl: string } }>(
    `/organizations/${organizationId}/workers/${workerId}/credentials/${credentialId}/documents/upload-url`,
    { originalFilename: file.name, contentType: file.type, sizeBytes: file.size },
    token,
  );
  await apiClient.postBinary<{ upload: { fileId: string } }>(
    `/organizations/${organizationId}/workers/${workerId}/credentials/${credentialId}/documents/${initiated.upload.fileId}/content`,
    file,
    file.type,
    token,
  );
  const completed = await apiClient.post<{ document: { documentId: string; fileId: string; version: number; status: string } }>(
    `/organizations/${organizationId}/workers/${workerId}/credentials/${credentialId}/documents/${initiated.upload.fileId}/complete`,
    {}, token,
  );
  return completed.document;
}

export async function listCredentialDocuments(
  organizationId: string, workerId: string, credentialId: string, token: string,
) {
  const result = await apiClient.get<{ documents: CredentialDocumentVersion[] }>(
    `/organizations/${organizationId}/workers/${workerId}/credentials/${credentialId}/documents`, token,
  );
  return result.documents;
}

export async function openCredentialDocument(
  organizationId: string, workerId: string, credentialId: string, fileId: string, token: string,
) {
  const result = await apiClient.post<{ download: { downloadUrl: string; expiresInSeconds: number } }>(
    `/organizations/${organizationId}/workers/${workerId}/credentials/${credentialId}/documents/${fileId}/download-url`, {}, token,
  );
  return result.download.downloadUrl;
}

export async function reviewWorkerCredential(
  organizationId: string,
  membershipId: string,
  credentialId: string,
  reviewStatus: "pending" | "approved" | "rejected",
  notes: string,
  token: string,
) {
  const result = await apiClient.post<{ review: { id: string; review_status: string; notes: string | null } }>(
    `/organizations/${organizationId}/workers/${membershipId}/credentials/${credentialId}/review`,
    { reviewStatus, ...(notes.trim() ? { notes: notes.trim() } : {}) }, token,
  );
  return result.review;
}

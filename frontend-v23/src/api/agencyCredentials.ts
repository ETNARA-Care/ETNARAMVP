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

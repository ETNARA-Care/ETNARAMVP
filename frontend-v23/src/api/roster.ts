import { apiClient } from "./client";
import type { CareRecipient, WorkerMembership } from "./shifts";

export interface CreateCareRecipientInput {
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  allergies?: string[];
}

export interface UpdateCareRecipientInput {
  firstName?: string;
  lastName?: string;
  preferredName?: string | null;
  dateOfBirth?: string | null;
  allergies?: string[] | null;
  status?: "active" | "archived";
}

export interface CreateWorkerInput {
  displayName: string;
  internalRole: string;
  hiredAt?: string;
}

export interface UpdateWorkerInput {
  displayName?: string;
  internalRole?: string;
  hiredAt?: string | null;
  status?: "active" | "inactive";
  endedAt?: string | null;
}

export async function createCareRecipient(
  organizationId: string,
  input: CreateCareRecipientInput,
  token: string,
): Promise<CareRecipient> {
  const result = await apiClient.post<{ recipient: CareRecipient }>(
    `/organizations/${organizationId}/care-recipients`,
    input,
    token,
  );
  return result.recipient;
}

export async function updateCareRecipient(
  organizationId: string,
  recipientId: string,
  input: UpdateCareRecipientInput,
  token: string,
): Promise<CareRecipient> {
  const result = await apiClient.patch<{ recipient: CareRecipient }>(
    `/organizations/${organizationId}/care-recipients/${recipientId}`,
    input,
    token,
  );
  return result.recipient;
}

export async function createWorker(
  organizationId: string,
  input: CreateWorkerInput,
  token: string,
): Promise<WorkerMembership> {
  const result = await apiClient.post<{ membership: WorkerMembership }>(
    `/organizations/${organizationId}/workers`,
    input,
    token,
  );
  return result.membership;
}

export async function updateWorker(
  organizationId: string,
  membershipId: string,
  input: UpdateWorkerInput,
  token: string,
): Promise<WorkerMembership> {
  const result = await apiClient.patch<{ membership: WorkerMembership }>(
    `/organizations/${organizationId}/workers/${membershipId}`,
    input,
    token,
  );
  return result.membership;
}

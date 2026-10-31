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

/** Shown when saving a staff member fails; covers the backend's rule for inactive memberships (30-oct-2026). */
export const INACTIVE_RENAME_MESSAGE = "Esta persona tiene la membresía inactiva. Reactívala para cambiar su nombre.";
/** C2 (31-oct-2026): rol, estado y nombre de una cuidadora los cambia la administración de la agencia. */
export const ESTABLISHMENT_STAFF_CHANGE_MESSAGE = "El rol, el estado y el nombre del personal los cambia la administración o la supervisión de la agencia.";

/** C1/C2: mensajes de asignación en un establecimiento. */
export function establishmentAssignmentErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "RESIDENT_TRANSFER_FORBIDDEN") return "Solo la administración o la supervisión de la agencia puede traer residentes de otro establecimiento o del servicio a domicilio.";
  if (code === "ESTABLISHMENT_STAFF_ASSIGNMENT_FORBIDDEN") return "Solo la administración o la supervisión de la agencia puede asignar personal existente a un establecimiento.";
  return "No pudimos completar la asignación.";
}

export function workerUpdateErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "WORKER_MEMBERSHIP_INACTIVE") return INACTIVE_RENAME_MESSAGE;
  if (code === "WORKER_PROFILE_NOT_SAVED") return "No se guardó el nombre. Vuelve a intentarlo; si continúa, avisa a soporte.";
  if (code === "ESTABLISHMENT_STAFF_CHANGE_FORBIDDEN") return ESTABLISHMENT_STAFF_CHANGE_MESSAGE;
  return fallback;
}

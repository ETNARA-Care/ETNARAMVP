import { apiClient } from "./client";

export type ShiftStatus = "unassigned" | "confirmed" | "in_progress" | "completed" | "cancelled";

export interface Shift {
  id: string;
  organization_id: string;
  care_recipient_id: string | null;
  room_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: ShiftStatus;
  assignment_count?: number;
}

export interface CareRecipient {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  allergies: string[] | null;
  preferences: unknown;
  routines: unknown;
  status: string;
  room_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface WorkerMembership {
  id: string;
  worker_id: string;
  status: string;
  internal_role: string;
  display_name: string | null;
}

export interface Assignment {
  id: string;
  shift_id: string;
  organization_worker_membership_id: string;
}

export interface VisitVerification {
  shiftId: string;
  events: Array<{ id: string; eventType: string; occurredAt: string }>;
  status: "not_started" | "in_progress" | "completed";
}

export async function listShifts(organizationId: string, token: string): Promise<Shift[]> {
  const result = await apiClient.get<{ shifts: Shift[] }>(`/organizations/${organizationId}/shifts`, token);
  return result.shifts;
}

export async function listMyShifts(organizationId: string, token: string): Promise<Shift[]> {
  const result = await apiClient.get<{ shifts: Shift[] }>(`/organizations/${organizationId}/me/shifts`, token);
  return result.shifts;
}

export async function getShift(organizationId: string, shiftId: string, token: string): Promise<Shift> {
  const result = await apiClient.get<{ shift: Shift }>(`/organizations/${organizationId}/shifts/${shiftId}`, token);
  return result.shift;
}

export async function createShift(
  organizationId: string,
  input: { careRecipientId: string; scheduledStart: string; scheduledEnd: string },
  token: string,
): Promise<Shift> {
  const result = await apiClient.post<{ shift: Shift }>(`/organizations/${organizationId}/shifts`, input, token);
  return result.shift;
}

export async function listCareRecipients(organizationId: string, token: string): Promise<CareRecipient[]> {
  const result = await apiClient.get<{ recipients: CareRecipient[] }>(
    `/organizations/${organizationId}/care-recipients`,
    token,
  );
  return result.recipients;
}

export async function getCareRecipient(
  organizationId: string,
  recipientId: string,
  token: string,
): Promise<CareRecipient> {
  const result = await apiClient.get<{ recipient: CareRecipient }>(
    `/organizations/${organizationId}/care-recipients/${recipientId}`,
    token,
  );
  return result.recipient;
}

export async function listWorkers(organizationId: string, token: string): Promise<WorkerMembership[]> {
  const result = await apiClient.get<{ memberships: WorkerMembership[] }>(
    `/organizations/${organizationId}/workers`,
    token,
  );
  return result.memberships;
}

export async function listAssignments(organizationId: string, shiftId: string, token: string): Promise<Assignment[]> {
  const result = await apiClient.get<{ assignments: Assignment[] }>(
    `/organizations/${organizationId}/shifts/${shiftId}/assignments`,
    token,
  );
  return result.assignments;
}

export async function assignShift(
  organizationId: string,
  shiftId: string,
  organizationWorkerMembershipId: string,
  token: string,
): Promise<Assignment> {
  const result = await apiClient.post<{ assignment: Assignment }>(
    `/organizations/${organizationId}/shifts/${shiftId}/assignments`,
    { organizationWorkerMembershipId },
    token,
  );
  return result.assignment;
}

export async function getVisitVerification(
  organizationId: string,
  shiftId: string,
  token: string,
): Promise<VisitVerification> {
  return apiClient.get(`/organizations/${organizationId}/shifts/${shiftId}/visit-verification`, token);
}

export async function checkIn(organizationId: string, shiftId: string, token: string): Promise<void> {
  await apiClient.post(
    `/organizations/${organizationId}/shifts/${shiftId}/check-in`,
    { verificationMethodCode: "CAREGIVER_SESSION" },
    token,
  );
}

export async function checkOut(organizationId: string, shiftId: string, token: string): Promise<void> {
  await apiClient.post(`/organizations/${organizationId}/shifts/${shiftId}/check-out`, {}, token);
}

export function recipientName(recipient: CareRecipient | undefined): string {
  if (!recipient) return "Persona atendida";
  return recipient.preferred_name || `${recipient.first_name} ${recipient.last_name}`.trim();
}

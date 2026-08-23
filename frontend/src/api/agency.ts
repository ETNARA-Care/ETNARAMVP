import { apiFetch } from "./client";

export interface OrgCareRecipient {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  status: string;
  room_id: string | null;
  created_at: string;
}

export async function listOrgCareRecipients(organizationId: string): Promise<OrgCareRecipient[]> {
  const res = await apiFetch<{ recipients: OrgCareRecipient[] }>(`/organizations/${organizationId}/care-recipients`);
  return res.recipients;
}

export async function getOrgCareRecipient(organizationId: string, recipientId: string): Promise<OrgCareRecipient> {
  const res = await apiFetch<{ recipient: OrgCareRecipient }>(
    `/organizations/${organizationId}/care-recipients/${recipientId}`
  );
  return res.recipient;
}

export interface OrgShift {
  id: string;
  organization_id: string;
  care_recipient_id: string | null;
  room_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
}

export async function listOrgShifts(
  organizationId: string,
  filter: { dateFrom?: string; dateTo?: string } = {}
): Promise<OrgShift[]> {
  const res = await apiFetch<{ shifts: OrgShift[] }>(`/organizations/${organizationId}/shifts`, { query: filter });
  return res.shifts;
}

export async function getOrgShift(organizationId: string, shiftId: string): Promise<OrgShift> {
  const res = await apiFetch<{ shift: OrgShift }>(`/organizations/${organizationId}/shifts/${shiftId}`);
  return res.shift;
}

export interface CoverageSummary {
  total: number;
  covered: number;
  uncovered: number;
  cancelled: number;
}

export async function getShiftCoverage(organizationId: string): Promise<CoverageSummary> {
  return apiFetch<CoverageSummary>(`/organizations/${organizationId}/shifts/coverage`);
}

export interface OrgWorkerMembership {
  id: string;
  worker_id: string;
  organization_id: string;
  status: string;
  internal_role: string;
}

export async function listOrgWorkers(organizationId: string): Promise<OrgWorkerMembership[]> {
  const res = await apiFetch<{ memberships: OrgWorkerMembership[] }>(`/organizations/${organizationId}/workers`);
  return res.memberships;
}

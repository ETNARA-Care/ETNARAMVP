import { apiFetch } from "./client";

export interface FamilyObservation {
  id: string;
  careRecipientId: string;
  category: string;
  status: "reviewed";
  createdAt: string;
}

export interface FamilyIncident {
  id: string;
  careRecipientId: string;
  severity: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface FamilyShift {
  id: string;
  careRecipientId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

export async function listFamilyObservations(
  organizationId: string,
  careRecipientId: string
): Promise<FamilyObservation[]> {
  const res = await apiFetch<{ observations: FamilyObservation[] }>(
    `/organizations/${organizationId}/care-recipients/${careRecipientId}/family-observations`
  );
  return res.observations;
}

export async function listFamilyIncidents(
  organizationId: string,
  careRecipientId: string
): Promise<FamilyIncident[]> {
  const res = await apiFetch<{ incidents: FamilyIncident[] }>(
    `/organizations/${organizationId}/care-recipients/${careRecipientId}/family-incidents`
  );
  return res.incidents;
}

export async function listFamilyShifts(organizationId: string, careRecipientId: string): Promise<FamilyShift[]> {
  const res = await apiFetch<{ shifts: FamilyShift[] }>(
    `/organizations/${organizationId}/care-recipients/${careRecipientId}/family-shifts`
  );
  return res.shifts;
}

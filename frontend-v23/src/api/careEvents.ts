import { apiClient } from "./client";

export type CareEventTypeCode = "MEAL" | "HYDRATION" | "TOILETING" | "MOBILITY" | "ACTIVITY" | "MOOD" | "NOTE";

export interface CareEvent {
  id: string;
  shift_id: string;
  care_recipient_id: string;
  organization_worker_membership_id: string;
  type_code: CareEventTypeCode;
  occurred_at: string;
  note_text: string | null;
  structured_data: unknown;
}

export async function listShiftCareEvents(organizationId: string, shiftId: string, token: string): Promise<CareEvent[]> {
  const result = await apiClient.get<{ events: CareEvent[] }>(
    `/organizations/${organizationId}/shifts/${shiftId}/care-events`,
    token,
  );
  return result.events;
}

export async function listRecipientCareEvents(
  organizationId: string,
  careRecipientId: string,
  token: string,
): Promise<CareEvent[]> {
  const result = await apiClient.get<{ events: CareEvent[] }>(
    `/organizations/${organizationId}/care-recipients/${careRecipientId}/care-events`,
    token,
  );
  return result.events;
}

export async function createCareEvent(
  organizationId: string,
  shiftId: string,
  input: { typeCode: CareEventTypeCode; careRecipientId: string; noteText?: string; payload?: Record<string, unknown> },
  token: string,
): Promise<CareEvent> {
  const result = await apiClient.post<{ event: CareEvent }>(
    `/organizations/${organizationId}/shifts/${shiftId}/care-events`,
    input,
    token,
  );
  return result.event;
}

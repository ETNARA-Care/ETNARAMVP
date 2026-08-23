import { apiFetch } from "./client";

// Los 8 tipos reales confirmados en care_event_types (migración 016 del
// backend real de staging). No se inventa ningún tipo adicional.
export type CareEventTypeCode =
  | "MEAL"
  | "HYDRATION"
  | "TOILETING"
  | "MOBILITY"
  | "ACTIVITY"
  | "MOOD"
  | "NOTE"
  | "PHOTO";

export interface CareEvent {
  id: string;
  organization_id: string;
  shift_id: string;
  care_recipient_id: string;
  organization_worker_membership_id: string;
  care_event_type_id: string;
  type_code?: CareEventTypeCode;
  occurred_at: string;
  note_text: string | null;
  structured_data: unknown;
  created_at: string;
}

export interface CreateCareEventInput {
  typeCode: CareEventTypeCode;
  careRecipientId: string;
  noteText?: string;
  payload?: Record<string, unknown>;
  storedFileId?: string;
}

export async function createCareEvent(
  organizationId: string,
  shiftId: string,
  input: CreateCareEventInput
): Promise<CareEvent> {
  const res = await apiFetch<{ event: CareEvent }>(
    `/organizations/${organizationId}/shifts/${shiftId}/care-events`,
    { method: "POST", body: input }
  );
  return res.event;
}

export async function listShiftCareEvents(organizationId: string, shiftId: string): Promise<CareEvent[]> {
  const res = await apiFetch<{ events: CareEvent[] }>(
    `/organizations/${organizationId}/shifts/${shiftId}/care-events`
  );
  return res.events;
}

export async function listRecipientCareEvents(organizationId: string, careRecipientId: string): Promise<CareEvent[]> {
  const res = await apiFetch<{ events: CareEvent[] }>(
    `/organizations/${organizationId}/care-recipients/${careRecipientId}/care-events`
  );
  return res.events;
}

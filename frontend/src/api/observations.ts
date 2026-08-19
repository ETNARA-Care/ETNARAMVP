import { apiFetch } from "./client";

// Enum real confirmado (observation_category_enum, migración 012 del
// backend real de staging). No se inventa ninguna categoría adicional.
export type ObservationCategory =
  | "low_appetite"
  | "drowsiness"
  | "confusion"
  | "pain"
  | "behavior_change"
  | "reduced_mobility"
  | "elimination_change"
  | "emotional_state"
  | "other";

export type ObservationStatus = "open" | "reviewed" | "escalated";

export interface Observation {
  id: string;
  organization_id: string;
  care_recipient_id: string;
  organization_worker_membership_id: string;
  care_event_id: string | null;
  category: ObservationCategory;
  description: string | null;
  status: ObservationStatus;
  created_at: string;
}

export interface CreateObservationInput {
  careRecipientId: string;
  category: ObservationCategory;
  description?: string;
  careEventId?: string;
}

export async function createObservation(organizationId: string, input: CreateObservationInput): Promise<Observation> {
  const res = await apiFetch<{ observation: Observation }>(`/organizations/${organizationId}/observations`, {
    method: "POST",
    body: input,
  });
  return res.observation;
}

export async function listObservations(
  organizationId: string,
  filter: { careRecipientId?: string; status?: string } = {}
): Promise<Observation[]> {
  const res = await apiFetch<{ observations: Observation[] }>(`/organizations/${organizationId}/observations`, {
    query: filter,
  });
  return res.observations;
}

export async function getObservation(organizationId: string, observationId: string): Promise<Observation> {
  const res = await apiFetch<{ observation: Observation }>(
    `/organizations/${organizationId}/observations/${observationId}`
  );
  return res.observation;
}

// NOTA: marcar una Observation como "reviewed" (POST .../review) requiere
// autoridad de manager en el backend real (REQUIRES_ORG_MANAGER si no) --
// deliberadamente no se expone aquí ninguna función para esa acción, porque
// el Caregiver nunca debe ver ese control.

import { apiFetch } from "./client";

export interface VerificationEvent {
  id: string;
  event_type: "check_in" | "check_out";
  occurred_at: string;
}

export async function checkIn(organizationId: string, shiftId: string): Promise<VerificationEvent> {
  const res = await apiFetch<{ event: VerificationEvent }>(`/organizations/${organizationId}/shifts/${shiftId}/check-in`, {
    method: "POST",
    body: { verificationMethodCode: "CAREGIVER_SESSION" },
  });
  return res.event;
}

export async function checkOut(organizationId: string, shiftId: string): Promise<VerificationEvent> {
  const res = await apiFetch<{ event: VerificationEvent }>(`/organizations/${organizationId}/shifts/${shiftId}/check-out`, {
    method: "POST",
    body: {},
  });
  return res.event;
}

export interface VisitVerificationSummary {
  shiftId: string;
  events: Array<{ id: string; eventType: string; occurredAt: string; methodCode: string; membershipId: string }>;
  status: "not_started" | "in_progress" | "completed";
}

export async function getVisitVerification(organizationId: string, shiftId: string): Promise<VisitVerificationSummary> {
  return apiFetch(`/organizations/${organizationId}/shifts/${shiftId}/visit-verification`);
}

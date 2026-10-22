import { apiFetch } from "./client";

export interface SmartMatchOpportunity {
  id: string;
  region_label: string;
  role_label: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

export function listSmartMatchOpportunities(organizationId: string) {
  return apiFetch<{ opportunities: SmartMatchOpportunity[] }>(
    `/organizations/${encodeURIComponent(organizationId)}/smartmatch/opportunities`,
  );
}

export function createSmartMatchDraft(
  organizationId: string,
  input: { regionLabel: string; roleLabel: string; startsAt: string; endsAt: string },
) {
  return apiFetch<{ opportunity: SmartMatchOpportunity }>(
    `/organizations/${encodeURIComponent(organizationId)}/smartmatch/opportunities`,
    { method: "POST", body: { ...input, visibility: "INTERNAL" } },
  );
}

export function publishSmartMatchDraft(organizationId: string, opportunityId: string) {
  return apiFetch<{ opportunity: Pick<SmartMatchOpportunity, "id" | "status"> }>(
    `/organizations/${encodeURIComponent(organizationId)}/smartmatch/opportunities/${encodeURIComponent(opportunityId)}/publish`,
    { method: "POST" },
  );
}

export interface SmartMatchApplicationCount {
  opportunity_id: string;
  pending_count: number;
}

export function listSmartMatchApplicationCounts(organizationId: string) {
  return apiFetch<{ counts: SmartMatchApplicationCount[] }>(
    `/organizations/${encodeURIComponent(organizationId)}/smartmatch/application-counts`,
  );
}

export interface SmartMatchPendingApplication {
  id: string;
  status: "PENDING";
  created_at: string;
}

export function listSmartMatchPendingApplications(organizationId: string, opportunityId: string) {
  return apiFetch<{ applications: SmartMatchPendingApplication[] }>(
    `/organizations/${encodeURIComponent(organizationId)}/smartmatch/opportunities/${encodeURIComponent(opportunityId)}/applications`,
  );
}

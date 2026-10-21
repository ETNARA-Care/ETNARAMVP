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

import { apiClient } from "./client";

export type ComplianceRequirementStatus =
  | "satisfied"
  | "MISSING_CREDENTIAL"
  | "CREDENTIAL_NOT_ACTIVE"
  | "CREDENTIAL_EXPIRED"
  | "PLATFORM_VERIFICATION_MISSING"
  | "ORGANIZATION_REVIEW_MISSING";

export interface ComplianceRequirement {
  requirement: string;
  status: ComplianceRequirementStatus;
  requiresOrganizationReview: boolean;
}

export interface ComplianceSummary {
  eligibility: "eligible" | "not_eligible";
  requirements: ComplianceRequirement[];
}

export async function getWorkerCompliance(
  organizationId: string,
  membershipId: string,
  token: string,
): Promise<ComplianceSummary> {
  return apiClient.get(
    `/organizations/${organizationId}/workers/${membershipId}/compliance`,
    token,
  );
}

import { apiClient } from "./client";

export type ComplianceRequirementStatus =
  | "satisfied"
  | "MISSING_CREDENTIAL"
  | "CREDENTIAL_NOT_ACTIVE"
  | "CREDENTIAL_EXPIRED"
  | "CREDENTIAL_REVOKED"
  | "PLATFORM_VERIFICATION_MISSING"
  | "PLATFORM_VERIFICATION_REJECTED"
  | "ORGANIZATION_REVIEW_MISSING";

export interface ComplianceRequirement {
  requirement: string;
  status: ComplianceRequirementStatus;
  isMandatory: boolean;
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

export interface CompliancePolicyRequirement {
  credentialTypeCode: string;
  credentialTypeName: string;
  isMandatory: boolean;
  requiresOrganizationReview: boolean;
}

export interface CompliancePolicy {
  workerRole: string;
  requirementSetId: string;
  source: "organization" | "platform";
  requirements: CompliancePolicyRequirement[];
}

export interface ComplianceConfiguration {
  workerRoles: string[];
  credentialTypes: Array<{ code: string; name: string }>;
  policies: CompliancePolicy[];
}

export interface ComplianceAuditEntry {
  id: string;
  actorUserId: string | null;
  action: "COMPLIANCE_REQUIREMENTS_UPDATED" | "WORKER_MEMBERSHIP_STATUS_CHANGED";
  entityType: string;
  occurredAt: string;
  previousValue: unknown;
  newValue: unknown;
}

export async function getComplianceConfiguration(
  organizationId: string,
  token: string,
): Promise<ComplianceConfiguration> {
  return apiClient.get(`/organizations/${organizationId}/compliance/configuration`, token);
}

export async function saveCompliancePolicy(
  organizationId: string,
  input: {
    workerRole: string;
    requirements: Array<{
      credentialTypeCode: string;
      isMandatory: boolean;
      requiresOrganizationReview: boolean;
    }>;
  },
  token: string,
): Promise<{ policy: CompliancePolicy }> {
  return apiClient.put(`/organizations/${organizationId}/compliance/configuration`, input, token);
}

export async function getComplianceAudit(
  organizationId: string,
  token: string,
): Promise<{ entries: ComplianceAuditEntry[] }> {
  return apiClient.get(`/organizations/${organizationId}/compliance/audit`, token);
}

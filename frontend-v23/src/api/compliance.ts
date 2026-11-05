import { apiClient } from "./client";

export type ComplianceRequirementStatus =
  | "satisfied"
  | "MISSING_CREDENTIAL"
  | "CREDENTIAL_NOT_ACTIVE"
  | "CREDENTIAL_EXPIRED"
  | "CREDENTIAL_REVOKED"
  | "PLATFORM_VERIFICATION_MISSING"
  | "PLATFORM_VERIFICATION_REJECTED"
  | "ORGANIZATION_REVIEW_MISSING"
  | "ORGANIZATION_REVIEW_REJECTED";

export interface ComplianceRequirement {
  requirement: string;
  status: ComplianceRequirementStatus;
  isMandatory: boolean;
  requiresOrganizationReview: boolean;
}

export interface ComplianceSummary {
  // "unconfigured": la agencia no tiene requisitos para el puesto de esta persona. Sigue sin
  // poder trabajar: ETNARA no impone una lista universal (decisión 4-nov-2026).
  eligibility: "eligible" | "not_eligible" | "unconfigured";
  requirements: ComplianceRequirement[];
}

export const UNCONFIGURED_REQUIREMENTS_TITLE = "Requisitos sin configurar para este puesto";
export const COMPLIANCE_POLICIES_ANCHOR = "politicas";
export const COMPLIANCE_POLICIES_PATH = `/agency/compliance#${COMPLIANCE_POLICIES_ANCHOR}`;

export function requirementsUnconfigured(summary: ComplianceSummary | null | undefined): boolean {
  return summary?.eligibility === "unconfigured";
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

export interface ComplianceAgentPriority {
  rank: number;
  membershipId: string;
  workerName: string;
  workerRole: string;
  severity: "critical" | "warning";
  title: string;
  reason: string;
  blockerCodes: string[];
  nearestExpiry: string | null;
  recommendedAction: string;
  actionPath: string;
  requiresHumanConfirmation: true;
}

export interface ComplianceAgentBriefing {
  runId: string;
  generatedAt: string;
  mode: "advisory";
  headline: string;
  narrative: string;
  summary: {
    activeWorkers: number;
    eligibleWorkers: number;
    blockedWorkers: number;
    expiringWorkers: number;
  };
  priorities: ComplianceAgentPriority[];
  guardrails: string[];
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

export async function generateComplianceAgentBriefing(
  organizationId: string,
  token: string,
): Promise<ComplianceAgentBriefing> {
  return apiClient.post(
    `/organizations/${organizationId}/compliance/agent/briefing`,
    {},
    token,
  );
}

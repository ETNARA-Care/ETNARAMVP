import { apiClient } from "./client";

/**
 * SmartMatch: oportunidades internas de la agencia. Solo metadatos
 * saneados (municipio, función, horario): nunca nombres de pacientes,
 * direcciones exactas ni información clínica.
 */
export const SMARTMATCH_CONSENT_VERSION = "smartmatch-consent-v1";

export type OpportunityStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "EXPIRED" | "FILLED";
export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
export type DecisionReason = "APPROVED_ELIGIBLE" | "AGENCY_REJECTED" | "OPPORTUNITY_FILLED";

export interface AgencyOpportunity {
  id: string; region_label: string; role_label: string;
  starts_at: string; ends_at: string; status: OpportunityStatus;
}
export interface AvailableOpportunity {
  id: string; region_label: string; role_label: string; starts_at: string; ends_at: string;
}
export interface MyApplication {
  id: string; status: ApplicationStatus; created_at: string; withdrawn_at: string | null;
  decided_at: string | null; decision_reason: DecisionReason | null;
  opportunity_id: string; region_label: string; role_label: string;
  starts_at: string; ends_at: string; opportunity_status: OpportunityStatus;
}
export interface ReviewQueueItem {
  id: string; status: ApplicationStatus; created_at: string; decided_at: string | null;
  decision_reason: DecisionReason | null; display_name: string | null;
}
export interface ApprovalChecks {
  membershipActive: boolean; credentialsEligible: boolean; credentialsVerifiable: boolean;
  unmetRequirementCodes: string[]; availabilityConfigured: boolean; availabilityCovers: boolean;
  noUnavailabilityConflict: boolean; consentRecorded: boolean; opportunityOpen: boolean;
  applicationPending: boolean; approvable: boolean;
}
export interface ApplicationReview {
  application: { id: string; status: ApplicationStatus; createdAt: string; consentedAt: string | null;
    decidedByUserId: string | null; decidedAt: string | null; decisionReason: DecisionReason | null };
  caregiver: { membershipId: string | null; displayName: string | null };
  opportunity: { id: string; status: OpportunityStatus; startsAt: string; endsAt: string };
  checks: ApprovalChecks;
}
export interface DecisionEvent {
  event_type: "SUBMITTED" | "WITHDRAWN" | "APPROVED" | "REJECTED";
  previous_status: ApplicationStatus | null; new_status: ApplicationStatus;
  actor_user_id: string | null; decision_reason: DecisionReason | null; occurred_at: string;
}

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}/smartmatch`;
const id = (value: string) => encodeURIComponent(value);

// ---------------------------------------------------------------- agencia
export async function listAgencyOpportunities(organizationId: string, token: string) {
  return (await apiClient.get<{ opportunities: AgencyOpportunity[] }>(`${base(organizationId)}/opportunities`, token)).opportunities;
}
export async function createOpportunityDraft(organizationId: string,
  input: { regionLabel: string; roleLabel: string; startsAt: string; endsAt: string }, token: string) {
  return (await apiClient.post<{ opportunity: AgencyOpportunity }>(`${base(organizationId)}/opportunities`,
    { ...input, visibility: "INTERNAL" }, token)).opportunity;
}
export async function publishOpportunity(organizationId: string, opportunityId: string, token: string) {
  return (await apiClient.post<{ opportunity: { id: string; status: OpportunityStatus } }>(
    `${base(organizationId)}/opportunities/${id(opportunityId)}/publish`, undefined, token)).opportunity;
}
export async function listPendingCounts(organizationId: string, token: string) {
  return (await apiClient.get<{ counts: { opportunity_id: string; pending_count: number }[] }>(
    `${base(organizationId)}/application-counts`, token)).counts;
}
export async function listReviewQueue(organizationId: string, opportunityId: string, token: string) {
  return (await apiClient.get<{ applications: ReviewQueueItem[] }>(
    `${base(organizationId)}/opportunities/${id(opportunityId)}/review-queue`, token)).applications;
}
export async function getApplicationReview(organizationId: string, applicationId: string, token: string) {
  return apiClient.get<ApplicationReview>(`${base(organizationId)}/applications/${id(applicationId)}/review`, token);
}
export async function decideApplication(organizationId: string, applicationId: string,
  decision: "APPROVE" | "REJECT", token: string) {
  const body = decision === "APPROVE" ? { decision, confirm: true } : { decision };
  return apiClient.post<{ outcome: "APPROVED" | "REJECTED"; closedApplications?: number }>(
    `${base(organizationId)}/applications/${id(applicationId)}/decision`, body, token);
}
export async function listDecisionHistory(organizationId: string, applicationId: string, token: string) {
  return (await apiClient.get<{ events: DecisionEvent[] }>(
    `${base(organizationId)}/applications/${id(applicationId)}/events`, token)).events;
}

// --------------------------------------------------------------- cuidador
export async function listAvailableOpportunities(organizationId: string, token: string) {
  return (await apiClient.get<{ opportunities: AvailableOpportunity[] }>(
    `${base(organizationId)}/available-opportunities`, token)).opportunities;
}
export async function listMyApplications(organizationId: string, token: string) {
  return (await apiClient.get<{ applications: MyApplication[] }>(`${base(organizationId)}/my-applications`, token)).applications;
}
/** El cuidador acepta explícitamente el texto de consentimiento vigente. */
export async function applyToOpportunity(organizationId: string, opportunityId: string, token: string) {
  return (await apiClient.post<{ application: { id: string; status: ApplicationStatus } }>(
    `${base(organizationId)}/opportunities/${id(opportunityId)}/applications`,
    { consent: true, consentVersion: SMARTMATCH_CONSENT_VERSION }, token)).application;
}
export async function withdrawApplication(organizationId: string, applicationId: string, token: string) {
  return (await apiClient.post<{ application: { id: string; status: ApplicationStatus } }>(
    `${base(organizationId)}/applications/${id(applicationId)}/withdraw`, undefined, token)).application;
}

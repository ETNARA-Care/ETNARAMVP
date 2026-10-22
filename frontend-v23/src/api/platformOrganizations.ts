import { apiClient } from "@/api/client";

export type PlatformOrganizationType = "agency" | "residential_establishment";
type BackendOrganizationType = "HOME_CARE_AGENCY" | "RESIDENTIAL_CARE_HOME";

interface BackendPlatformOrganization {
  id: string;
  name: string;
  organization_type: BackendOrganizationType;
  status: string;
  created_at?: string;
}

export interface PlatformOrganization {
  id: string;
  name: string;
  type: PlatformOrganizationType;
  status: string;
  created_at?: string;
}

export interface PlatformOrganizationOverview {
  organization: BackendPlatformOrganization;
  locations: { id: string; name: string }[];
  counts: { active_workers: number; residents: number };
}

export interface PlatformOrganizationCredentialSummary {
  total_active_workers: number;
  workers_with_credentials: number;
  credentials_total: number;
  credentials_pending: number;
  credentials_verified: number;
  credentials_rejected: number;
}

export interface PlatformEstablishment {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  created_at: string;
  updated_at: string;
  units_count: number;
  rooms_count: number;
  residents_count: number;
}

export interface CreatePlatformOrganizationInput {
  name: string;
  type: PlatformOrganizationType;
}

export interface OrganizationAdminInvitation {
  id: string;
  email: string;
  expires_at: string;
  organization_id: string;
  organization_name: string;
}

export interface OrganizationAdminInvitationInspection {
  invitation_type: "organization_admin";
  email_masked: string;
  organization_name: string;
  target_name: string;
  account_exists: boolean;
  expires_at: string;
}

export interface EmailDelivery {
  status: "sent" | "failed";
  messageId?: string;
  error?: string;
}

function fromBackend(o: BackendPlatformOrganization): PlatformOrganization {
  return { ...o, type: o.organization_type === "HOME_CARE_AGENCY" ? "agency" : "residential_establishment" };
}

function toBackendType(type: PlatformOrganizationType): BackendOrganizationType {
  return type === "agency" ? "HOME_CARE_AGENCY" : "RESIDENTIAL_CARE_HOME";
}

export async function listPlatformOrganizations(token: string): Promise<PlatformOrganization[]> {
  const result = await apiClient.get<{ organizations: BackendPlatformOrganization[] }>("/platform/organizations", token);
  return result.organizations.map(fromBackend);
}

export async function getPlatformOrganizationOverview(organizationId: string, token: string): Promise<PlatformOrganizationOverview> {
  return apiClient.get<PlatformOrganizationOverview>(`/platform/organizations/${encodeURIComponent(organizationId)}/overview`, token);
}

export async function getPlatformOrganizationEstablishment(organizationId: string, locationId: string, token: string): Promise<PlatformEstablishment> {
  const result = await apiClient.get<{ establishment: PlatformEstablishment }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/establishments/${encodeURIComponent(locationId)}`,
    token,
  );
  return result.establishment;
}

export async function getPlatformOrganizationCredentialSummary(
  organizationId: string,
  token: string,
): Promise<PlatformOrganizationCredentialSummary> {
  const result = await apiClient.get<{ summary: PlatformOrganizationCredentialSummary }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/credentials`,
    token,
  );
  return result.summary;
}

export async function createPlatformOrganization(input: CreatePlatformOrganizationInput, token: string): Promise<PlatformOrganization> {
  const result = await apiClient.post<{ organization: BackendPlatformOrganization }>(
    "/platform/organizations",
    { name: input.name, organizationType: toBackendType(input.type), status: "active" },
    token,
  );
  return fromBackend(result.organization);
}

export async function inviteOrganizationAdmin(
  organizationId: string,
  email: string,
  token: string,
): Promise<{ invitation: OrganizationAdminInvitation; activationToken: string; emailDelivery: EmailDelivery }> {
  return apiClient.post(
    `/platform/organizations/${encodeURIComponent(organizationId)}/admin-invitations`,
    { email },
    token,
  );
}

export async function inspectOrganizationAdminInvitation(token: string): Promise<OrganizationAdminInvitationInspection> {
  const result = await apiClient.get<{ invitation: OrganizationAdminInvitationInspection }>(
    `/platform/admin-invitations/inspect?token=${encodeURIComponent(token)}`,
  );
  return result.invitation;
}

export function activateOrganizationAdminInvitation(token: string, password: string) {
  return apiClient.post<{ activation: { user_id: string; organization_id: string; invitation_type: "organization_admin" } }>(
    "/platform/admin-invitations/activate",
    { token, password },
  );
}

export type OrganizationLifecycleAction = "suspend" | "archive" | "reactivate";

export async function updatePlatformOrganizationLifecycle(
  organizationId: string,
  action: OrganizationLifecycleAction,
  reason: string,
  token: string,
): Promise<PlatformOrganization> {
  const result = await apiClient.patch<{ organization: BackendPlatformOrganization }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/lifecycle`,
    { action, reason },
    token,
  );
  return fromBackend(result.organization);
}

/** Fase 12.3: aceptar una invitación de equipo con una cuenta que ya existe (requiere sesión). */
export function acceptOrganizationAdminInvitation(token: string, sessionToken: string) {
  return apiClient.post<{ activation: { user_id: string; organization_id: string; invitation_type: "organization_admin" } }>(
    "/platform/admin-invitations/accept",
    { token },
    sessionToken,
  );
}

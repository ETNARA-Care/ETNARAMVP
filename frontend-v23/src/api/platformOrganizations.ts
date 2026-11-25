import { apiClient } from "@/api/client";

export type PlatformOrganizationType = "agency" | "residential_establishment" | "independent_provider";
type BackendOrganizationType = "HOME_CARE_AGENCY" | "RESIDENTIAL_CARE_HOME" | "INDEPENDENT_PROVIDER";

const FROM_BACKEND: Record<BackendOrganizationType, PlatformOrganizationType> = {
  HOME_CARE_AGENCY: "agency",
  RESIDENTIAL_CARE_HOME: "residential_establishment",
  INDEPENDENT_PROVIDER: "independent_provider",
};
const TO_BACKEND: Record<PlatformOrganizationType, BackendOrganizationType> = {
  agency: "HOME_CARE_AGENCY",
  residential_establishment: "RESIDENTIAL_CARE_HOME",
  independent_provider: "INDEPENDENT_PROVIDER",
};

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

/** Etapa 0: what Central sees of an email delivery (fixed codes only, never the provider's message). */
export interface EmailDelivery {
  status: "sent" | "failed";
  error?: "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED";
}

/**
 * Etapa 0: an administrator invitation as ETNARA Central sees it. Never the activation token or link: it
 * travels only in the email to the invitee.
 */
export interface CentralAdminInvitation {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  /** Still pending on the server (an expired-looking one is renewed by resending). */
  resendable: boolean;
  revocable: boolean;
}

// 160: antes todo lo que no era agencia se mostraba como hogar; un cuidador independiente se habría visto como hogar.
function fromBackend(o: BackendPlatformOrganization): PlatformOrganization {
  return { ...o, type: FROM_BACKEND[o.organization_type] ?? "agency" };
}

function toBackendType(type: PlatformOrganizationType): BackendOrganizationType {
  return TO_BACKEND[type];
}

/** 160: qué modalidades puede crear Central ahora mismo («Cuidador independiente» está apagada hasta completar los PR A, B y C). */
export async function listAvailableOrganizationTypes(token: string): Promise<PlatformOrganizationType[]> {
  const result = await apiClient.get<{ types: { code: BackendOrganizationType; available: boolean }[] }>("/platform/organization-types", token);
  return result.types.filter((t) => t.available && FROM_BACKEND[t.code]).map((t) => FROM_BACKEND[t.code]);
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
): Promise<{ invitation: OrganizationAdminInvitation; emailDelivery: EmailDelivery }> {
  const result = await apiClient.post<{ invitation: OrganizationAdminInvitation; emailDelivery: EmailDelivery }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/admin-invitations`,
    { email },
    token,
  );
  // Only these two fields reach the page, whatever an older backend might add.
  return { invitation: result.invitation, emailDelivery: { status: result.emailDelivery.status, ...(result.emailDelivery.error ? { error: result.emailDelivery.error } : {}) } };
}

export async function listCentralAdminInvitations(organizationId: string, token: string): Promise<CentralAdminInvitation[]> {
  const result = await apiClient.get<{ invitations: CentralAdminInvitation[] }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/admin-invitations`,
    token,
  );
  return result.invitations;
}

/** New link by email (the previous one stops working only if the new email goes out). */
export function resendCentralAdminInvitation(organizationId: string, invitationId: string, token: string) {
  return apiClient.post<{ invitation: CentralAdminInvitation; emailDelivery: EmailDelivery }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/admin-invitations/${encodeURIComponent(invitationId)}/resend`,
    undefined,
    token,
  );
}

export async function revokeCentralAdminInvitation(organizationId: string, invitationId: string, token: string): Promise<CentralAdminInvitation> {
  const result = await apiClient.post<{ invitation: CentralAdminInvitation }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/admin-invitations/${encodeURIComponent(invitationId)}/revoke`,
    undefined,
    token,
  );
  return result.invitation;
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

/** SmartMatch pilot switches per agency (backend migration 108). ETNARA central only. */
export type PilotFeatureCode = "SMARTMATCH" | "EN_CAMINO" | "FINANZAS" | "FACTURACION" | "SHIFT_REPORTS" | "PUSH_NOTIFICATIONS" | "ACTIVITY_PHOTOS" | "CONTRACTS";
/** 170 (hogares F0): el backend solo los envía para organizaciones RESIDENTIAL_CARE_HOME; nacen apagados. */
export type ResidentialFeatureCode = "HOGAR_CALENDARIO" | "HOGAR_ASIGNACIONES" | "HOGAR_PONCHES" | "DEMO_ENVIRONMENT";
export type CentralFeatureCode = PilotFeatureCode | ResidentialFeatureCode;
export interface OrganizationFeatures {
  features: { code: CentralFeatureCode; enabled: boolean; updatedAt: string | null }[];
  history: { code: CentralFeatureCode; enabled: boolean; reason: string; occurredAt: string; actorEmail: string | null }[];
}
/**
 * 145 (§5): solo al ir a apagar Fotos: ¿tiene la agencia ALGUNA foto con retención legal? (sí/no; nunca
 * cuántas ni cuáles). Cada consulta queda auditada en el backend.
 */
export async function checkActivityPhotosLegalHolds(organizationId: string, token: string): Promise<boolean> {
  const r = await apiClient.post<{ legalHolds: boolean }>(`/platform/organizations/${encodeURIComponent(organizationId)}/features/ACTIVITY_PHOTOS/legal-hold-check`, {}, token);
  return r.legalHolds === true;
}
export function getOrganizationFeatures(organizationId: string, token: string) {
  return apiClient.get<OrganizationFeatures>(`/platform/organizations/${encodeURIComponent(organizationId)}/features`, token);
}
export function setOrganizationFeature(organizationId: string, code: CentralFeatureCode, enabled: boolean, reason: string, token: string) {
  return apiClient.put<{ feature: { code: CentralFeatureCode; enabled: boolean; changed: boolean; legalHoldsKept?: boolean } }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/features/${code}`, { enabled, reason }, token);
}

/**
 * Facturación Premium F2.1: ETNARA central sees the agency's administrators
 * (e-mail and whether they manage billing permissions — never invoices, rates
 * or amounts) and designates the billing permissions manager, with a reason.
 */
export interface BillingAdminsForCentral { billingEnabled: boolean; admins: { membershipId: string; email: string; isManager: boolean }[] }
export function getBillingAdmins(organizationId: string, token: string) {
  return apiClient.get<BillingAdminsForCentral>(`/platform/organizations/${encodeURIComponent(organizationId)}/billing-admins`, token);
}
export function designateBillingManager(organizationId: string, membershipId: string, reason: string, token: string) {
  return apiClient.post<{ designation: { membershipId: string; granted: number } }>(
    `/platform/organizations/${encodeURIComponent(organizationId)}/billing-manager`, { membershipId, reason }, token);
}

import { apiClient, type ApiError } from "./client";

export type AccessInvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface AccessInvitation {
  id: string;
  organization_id: string;
  invitation_type: "worker" | "family";
  email: string;
  worker_membership_id: string | null;
  care_recipient_id: string | null;
  relationship_type: string | null;
  status: AccessInvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  target_name: string;
  account_linked: boolean;
  /** Family invitations: when the e-mail provider last accepted the invitation e-mail (null = not sent). */
  email_sent_at?: string | null;
}

export interface InvitationInspection {
  invitation_type: "worker" | "family";
  email_masked: string;
  organization_name: string;
  target_name: string;
  account_exists: boolean;
  expires_at: string;
}

type WorkerInput = { type: "worker"; email: string; workerMembershipId: string };
type FamilyInput = { type: "family"; email: string; careRecipientId: string; relationshipType: string };

/** Staff (worker) invitations: the agency receives the one-time link and shares it. */
export async function createAccessInvitation(organizationId: string, input: WorkerInput, token: string) {
  return apiClient.post<{ invitation: AccessInvitation; token: string }>(
    `/organizations/${organizationId}/access-invitations`, input, token,
  );
}

/**
 * Family invitations travel only by e-mail: the response never carries the link.
 * Resolves only when the e-mail provider accepted the message. Errors:
 * 502 INVITATION_EMAIL_FAILED, 503 EMAIL_NOT_CONFIGURED (the invitation stays
 * pending; retrying re-uses it, no duplicate) and 429 RESEND_TOO_SOON.
 */
export interface FamilyInvitationSent { invitation: AccessInvitation; emailDelivery: { status: "sent" }; resent: boolean }
/**
 * A 2xx alone is not proof of an e-mail: only an explicit emailDelivery "sent" is. (A backend
 * without e-mail support answers 201 with a shareable link instead; that must never read as «enviada».)
 */
function requireSent(result: FamilyInvitationSent | null): FamilyInvitationSent {
  if (result?.emailDelivery?.status !== "sent") throw { status: 0, code: "EMAIL_NOT_CONFIRMED" } satisfies ApiError;
  return result;
}

export async function sendFamilyInvitation(organizationId: string, input: Omit<FamilyInput, "type">, token: string) {
  return requireSent(await apiClient.post<FamilyInvitationSent>(
    `/organizations/${organizationId}/access-invitations`, { type: "family", ...input }, token,
  ));
}

/** «Reenviar»: new 7-day link by e-mail; the previous link stops working only once the e-mail is accepted. */
export async function resendFamilyInvitation(organizationId: string, invitationId: string, token: string) {
  return requireSent(await apiClient.post<FamilyInvitationSent>(
    `/organizations/${organizationId}/access-invitations/${invitationId}/resend`, undefined, token,
  ));
}

export async function listAccessInvitations(
  organizationId: string,
  target: { workerMembershipId?: string; careRecipientId?: string },
  token: string,
) {
  const params = new URLSearchParams();
  if (target.workerMembershipId) params.set("workerMembershipId", target.workerMembershipId);
  if (target.careRecipientId) params.set("careRecipientId", target.careRecipientId);
  const result = await apiClient.get<{ invitations: AccessInvitation[] }>(
    `/organizations/${organizationId}/access-invitations?${params.toString()}`, token,
  );
  return result.invitations;
}

export function revokeAccessInvitation(organizationId: string, invitationId: string, token: string) {
  return apiClient.post<{ ok: true }>(
    `/organizations/${organizationId}/access-invitations/${invitationId}/revoke`, undefined, token,
  );
}

export function deactivateInvitedAccess(organizationId: string, invitationId: string, token: string) {
  return apiClient.post<{ ok: true }>(
    `/organizations/${organizationId}/access-invitations/${invitationId}/deactivate`, undefined, token,
  );
}

export function renewAccessInvitation(organizationId: string, invitationId: string, token: string) {
  return apiClient.post<{ invitation: AccessInvitation; token: string }>(
    `/organizations/${organizationId}/access-invitations/${invitationId}/renew`, undefined, token,
  );
}

export async function inspectAccessInvitation(token: string) {
  const result = await apiClient.post<{ invitation: InvitationInspection }>(
    "/access-invitations/inspect", { token },
  );
  return result.invitation;
}

export function activateAccessInvitation(token: string, password: string) {
  return apiClient.post<{ activation: { user_id: string; organization_id: string; invitation_type: string } }>(
    "/access-invitations/activate", { token, password },
  );
}

export function acceptAccessInvitation(token: string, sessionToken: string) {
  return apiClient.post<{ activation: { user_id: string; organization_id: string; invitation_type: string } }>(
    "/access-invitations/accept", { token }, sessionToken,
  );
}

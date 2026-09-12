import { apiClient } from "./client";

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
}

export interface InvitationInspection {
  invitation_type: "worker" | "family";
  email_masked: string;
  organization_name: string;
  target_name: string;
  account_exists: boolean;
  expires_at: string;
}

type CreateInput =
  | { type: "worker"; email: string; workerMembershipId: string }
  | { type: "family"; email: string; careRecipientId: string; relationshipType: string };

export async function createAccessInvitation(organizationId: string, input: CreateInput, token: string) {
  return apiClient.post<{ invitation: AccessInvitation; token: string }>(
    `/organizations/${organizationId}/access-invitations`, input, token,
  );
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

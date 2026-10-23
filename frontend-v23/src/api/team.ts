import { apiClient } from "./client";

/** Phase 12.2: an agency administrator invites administrators and supervisors. */
export type StaffRole = "ORGANIZATION_ADMIN" | "SUPERVISOR";

export interface TeamMember {
  membershipId: string;
  email: string;
  roles: StaffRole[];
  isYou: boolean;
  /** Si también trabaja turnos como cuidador/a en esta agencia. */
  workerMembershipId: string | null;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: StaffRole;
  expiresAt: string;
  createdAt: string;
}

export interface TeamInviteResult {
  invitation: TeamInvitation;
  token: string;
  emailDelivery: { status: "sent" | "failed"; error?: string };
}

export const staffRoleLabel: Record<StaffRole, string> = {
  ORGANIZATION_ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
};

export function listTeam(organizationId: string, token: string) {
  return apiClient.get<{ members: TeamMember[]; invitations: TeamInvitation[] }>(`/organizations/${organizationId}/team`, token);
}

export function inviteTeamMember(organizationId: string, input: { email: string; role: StaffRole }, token: string) {
  return apiClient.post<TeamInviteResult>(`/organizations/${organizationId}/team/invitations`, input, token);
}

export function revokeTeamInvitation(organizationId: string, invitationId: string, token: string) {
  return apiClient.post<{ id: string }>(`/organizations/${organizationId}/team/invitations/${invitationId}/revoke`, undefined, token);
}

/** Same page the ETNARA platform already uses for agency administrators. */
export function teamActivationLink(token: string) {
  const path = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}invite/organization-admin`;
  return `${new URL(path, window.location.origin).toString()}?token=${token}`;
}

/** Fase 12.3: dar o quitar un rol a alguien que ya está en la agencia. */
export function setStaffRole(
  organizationId: string,
  input: { membershipId?: string; workerMembershipId?: string; role: StaffRole; enabled: boolean },
  token: string,
) {
  return apiClient.post<{ membershipId: string; role: StaffRole; enabled: boolean }>(`/organizations/${organizationId}/team/roles`, input, token);
}

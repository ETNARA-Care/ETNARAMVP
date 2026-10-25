import { apiClient } from "./client";

/**
 * Facturación Premium F2.1 (backend migration 123). FACTURACION is a separate
 * premium switch that needs FINANZAS; only ETNARA central changes it. Agency
 * administrators hold separate capabilities; the backend and the database
 * decide every action (the portal only hides what the backend would refuse).
 */
export type BillingCapability = "view" | "draft" | "issue" | "void" | "manage";
export const BILLING_CAPABILITIES: BillingCapability[] = ["view", "draft", "issue", "void", "manage"];
export type BillingGrantSource = "manual" | "initial_single_admin" | "central_designation";

export interface BillingModuleState { finanzas: boolean; facturacion: boolean; enabled: boolean; readOnly: boolean }
export interface BillingAccess { module: BillingModuleState; capabilities: BillingCapability[] }

export interface BillingAdmin { membershipId: string; email: string; isMe: boolean; capabilities: BillingCapability[] }
export interface BillingGrant {
  id: string; membership_id: string; capability: BillingCapability; grant_source: BillingGrantSource; grant_reason: string;
  granted_at: string; granted_by_email: string | null; revoked_at: string | null; revoke_reason: string | null; revoked_by_email: string | null;
}
export interface BillingPermissions { module: BillingModuleState; canManage: boolean; admins: BillingAdmin[]; history: BillingGrant[] }

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}/billing`;

export const billingApi = {
  access: (organizationId: string, token: string) => apiClient.get<BillingAccess>(`${base(organizationId)}/access`, token),
  permissions: (organizationId: string, token: string) => apiClient.get<BillingPermissions>(`${base(organizationId)}/permissions`, token),
  grant: (organizationId: string, body: { membershipId: string; capability: BillingCapability; reason: string }, token: string) =>
    apiClient.post<{ permission: { id: string } }>(`${base(organizationId)}/permissions`, body, token),
  revoke: (organizationId: string, permissionId: string, reason: string, token: string) =>
    apiClient.post<{ permission: { id: string } }>(`${base(organizationId)}/permissions/${encodeURIComponent(permissionId)}/revoke`, { reason }, token),
};

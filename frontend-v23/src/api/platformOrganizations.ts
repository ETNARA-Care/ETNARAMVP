import { apiClient } from "@/api/client";

export type PlatformOrganizationType = "agency" | "residential_establishment";
export interface PlatformOrganization { id:string; name:string; type:PlatformOrganizationType; status:string; created_at?:string; }
export interface CreatePlatformOrganizationInput { name:string; type:PlatformOrganizationType; }
export interface OrganizationAdminInvitation { id:string; email:string; expires_at:string; organization_id:string; organization_name:string; }

export async function listPlatformOrganizations(token:string):Promise<PlatformOrganization[]>{
  const result=await apiClient.get<{organizations:PlatformOrganization[]}>("/platform/organizations",token);
  return result.organizations;
}
export async function createPlatformOrganization(input:CreatePlatformOrganizationInput,token:string):Promise<PlatformOrganization>{
  const result=await apiClient.post<{organization:PlatformOrganization}>("/platform/organizations",input,token);
  return result.organization;
}
export async function inviteOrganizationAdmin(organizationId:string,email:string,token:string):Promise<{invitation:OrganizationAdminInvitation;activationToken:string}>{
  return apiClient.post<{invitation:OrganizationAdminInvitation;activationToken:string}>(`/platform/organizations/${encodeURIComponent(organizationId)}/admin-invitations`,{email},token);
}

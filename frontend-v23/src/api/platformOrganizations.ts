import { apiClient } from "@/api/client";

export type PlatformOrganizationType = "agency" | "residential_establishment";
type BackendOrganizationType = "HOME_CARE_AGENCY" | "RESIDENTIAL_CARE_HOME";
interface BackendPlatformOrganization { id:string; name:string; organization_type:BackendOrganizationType; status:string; created_at?:string; }
export interface PlatformOrganization { id:string; name:string; type:PlatformOrganizationType; status:string; created_at?:string; }
export interface CreatePlatformOrganizationInput { name:string; type:PlatformOrganizationType; }
export interface OrganizationAdminInvitation { id:string; email:string; expires_at:string; organization_id:string; organization_name:string; }
export interface OrganizationAdminInvitationInspection { invitation_type:"organization_admin"; email_masked:string; organization_name:string; target_name:string; account_exists:boolean; expires_at:string; }
export interface EmailDelivery { status:"sent"|"failed"; messageId?:string; error?:string; }

function fromBackend(o:BackendPlatformOrganization):PlatformOrganization{
  return {...o,type:o.organization_type==="HOME_CARE_AGENCY"?"agency":"residential_establishment"};
}
function toBackendType(type:PlatformOrganizationType):BackendOrganizationType{
  return type==="agency"?"HOME_CARE_AGENCY":"RESIDENTIAL_CARE_HOME";
}

export async function listPlatformOrganizations(token:string):Promise<PlatformOrganization[]>{
  const result=await apiClient.get<{organizations:BackendPlatformOrganization[]}>("/platform/organizations",token);
  return result.organizations.map(fromBackend);
}
export async function createPlatformOrganization(input:CreatePlatformOrganizationInput,token:string):Promise<PlatformOrganization>{
  const result=await apiClient.post<{organization:BackendPlatformOrganization}>("/platform/organizations",{name:input.name,organizationType:toBackendType(input.type),status:"active"},token);
  return fromBackend(result.organization);
}
export async function inviteOrganizationAdmin(organizationId:string,email:string,token:string):Promise<{invitation:OrganizationAdminInvitation;activationToken:string;emailDelivery:EmailDelivery}>{
  return apiClient.post<{invitation:OrganizationAdminInvitation;activationToken:string;emailDelivery:EmailDelivery}>(`/platform/organizations/${encodeURIComponent(organizationId)}/admin-invitations`,{email},token);
}
export async function inspectOrganizationAdminInvitation(token:string):Promise<OrganizationAdminInvitationInspection>{
  const result=await apiClient.post<{invitation:OrganizationAdminInvitationInspection}>("/organization-admin-invitations/inspect",{token});
  return result.invitation;
}
export function activateOrganizationAdminInvitation(token:string,password:string){
  return apiClient.post<{activation:{user_id:string;organization_id:string;invitation_type:"organization_admin"}}>("/organization-admin-invitations/activate",{token,password});
}

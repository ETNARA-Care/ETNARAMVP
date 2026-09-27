import { apiClient } from "./client";

export interface Establishment { id:string; organization_id:string; name:string; address:string|null; status:"active"|"archived"; created_at:string; updated_at:string; }
export interface EstablishmentInput { name:string; address?:string; }
export interface EstablishmentPerson { membership_id:string; worker_id?:string; display_name?:string; email?:string; role?:string; status:string; }
export interface EstablishmentResident { id:string; first_name:string; last_name:string; preferred_name?:string|null; status:string; room_id?:string|null; }
export interface EstablishmentWorkspace { establishment:Pick<Establishment,"id"|"name"|"address">; personnel:EstablishmentPerson[]; residents:EstablishmentResident[]; administrators:EstablishmentPerson[]; administratorCandidates:EstablishmentPerson[]; }

export function listEstablishments(organizationId:string,token:string):Promise<{establishments:Establishment[]}>{return apiClient.get(`/organizations/${organizationId}/establishments`,token);}
export function createEstablishment(organizationId:string,input:EstablishmentInput,token:string):Promise<{establishment:Establishment}>{return apiClient.post(`/organizations/${organizationId}/establishments`,input,token);}
export function updateEstablishment(organizationId:string,establishmentId:string,input:Partial<EstablishmentInput>&{status?:Establishment["status"]},token:string):Promise<{establishment:Establishment}>{return apiClient.patch(`/organizations/${organizationId}/establishments/${establishmentId}`,input,token);}
export function getEstablishmentWorkspace(organizationId:string,establishmentId:string,token:string):Promise<EstablishmentWorkspace>{return apiClient.get(`/organizations/${organizationId}/establishments/${establishmentId}/workspace`,token);}
export function assignEstablishmentWorker(organizationId:string,establishmentId:string,membershipId:string,token:string){return apiClient.post(`/organizations/${organizationId}/establishments/${establishmentId}/personnel`,{membershipId},token);}
export function assignEstablishmentResident(organizationId:string,establishmentId:string,recipientId:string,token:string){return apiClient.post(`/organizations/${organizationId}/establishments/${establishmentId}/residents`,{recipientId},token);}
export function assignEstablishmentAdmin(organizationId:string,establishmentId:string,membershipId:string,token:string){return apiClient.post(`/organizations/${organizationId}/establishments/${establishmentId}/administrators`,{membershipId},token);}

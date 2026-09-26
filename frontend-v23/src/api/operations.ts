import { apiClient } from "./client";
export type OperationalSeverity="critical"|"warning"|"info";
export interface OperationalAlert{key:string;category:"uncovered_shift"|"missed_check_in"|"expiring_credential"|"open_incident"|"pending_timesheet";severity:OperationalSeverity;title:string;detail:string;relatedEntityType:string;relatedEntityId:string;actionPath:string;occurredAt:string;escalatedAt:string|null}
export interface OperationsCenter{generatedAt:string;summary:{total:number;critical:number;warning:number;info:number};alerts:OperationalAlert[]}
export const getOperationsCenter=(organizationId:string,token:string)=>apiClient.get<OperationsCenter>(`/organizations/${organizationId}/operations/center`,token);
export const escalateOperationalAlert=(organizationId:string,alert:OperationalAlert,token:string)=>apiClient.post(`/organizations/${organizationId}/operations/escalate`,{alertKey:alert.key,category:alert.category,relatedEntityType:alert.relatedEntityType,relatedEntityId:alert.relatedEntityId},token);

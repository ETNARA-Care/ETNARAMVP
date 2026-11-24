import { apiClient } from "@/api/client";

/** 161 · «Mis documentos» del cuidador independiente: autodeclarados; ETNARA Care no los verifica ni los aprueba. */
export type PracticeDocumentStatus = "REGISTERED" | "EXPIRING_SOON" | "EXPIRED" | "MISSING" | "RETIRED";

export const PRACTICE_STATUS_LABEL: Record<PracticeDocumentStatus, string> = {
  REGISTERED: "Registrado",
  EXPIRING_SOON: "Vence pronto",
  EXPIRED: "Vencido",
  MISSING: "Falta",
  RETIRED: "Retirado",
};
export const PRACTICE_STATUS_TONE: Record<PracticeDocumentStatus, "success" | "warning" | "danger" | "neutral"> = {
  REGISTERED: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
  MISSING: "danger",
  RETIRED: "neutral",
};

export interface PracticeRequirement { credentialTypeCode: string; name: string; isMandatory: boolean; status: PracticeDocumentStatus; expiresAt: string | null; documentId: string | null }
export interface PracticeDocument { id: string; credentialTypeCode: string; name: string; issuingEntityName: string | null; issuedAt: string | null; expiresAt: string | null; status: PracticeDocumentStatus; selfDeclared: boolean }
export interface PracticeDocuments {
  notice: string; policyConfigured: boolean; expiringSoonDays: number;
  requirements: PracticeRequirement[]; pendingMandatory: string[];
  documents: PracticeDocument[]; credentialTypes: Array<{ code: string; name: string }>;
}

const P = (org: string) => `/organizations/${org}/practice`;
export const practiceApi = {
  documents: (org: string, token: string) => apiClient.get<PracticeDocuments>(`${P(org)}/documents`, token),
  register: (org: string, body: { credentialTypeCode: string; issuingEntityName?: string; issuedAt?: string; expiresAt?: string }, token: string) =>
    apiClient.post<{ id: string }>(`${P(org)}/documents`, body, token),
  update: (org: string, id: string, body: { issuingEntityName?: string | null; issuedAt?: string | null; expiresAt?: string | null; retire?: true }, token: string) =>
    apiClient.patch<{ id: string }>(`${P(org)}/documents/${id}`, body, token),
  saveRequirements: (org: string, credentialTypeCodes: string[], token: string) =>
    apiClient.put<{ policy: unknown }>(`${P(org)}/requirements`, { credentialTypeCodes }, token),
};

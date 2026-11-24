import { apiClient } from "@/api/client";

/** 163 · Interruptor de modalidades de ETNARA Central (solo administración de plataforma). */
export type PlatformModalityCode = "INDEPENDENT_PROVIDER";

export interface PlatformModalityHistoryEntry {
  occurredAt: string;
  previousEnabled: boolean;
  newEnabled: boolean;
  reason: string;
  actorEmail: string | null;
}

export interface PlatformModality {
  code: PlatformModalityCode;
  enabled: boolean;
  updatedAt: string;
  registeredOrganizations: number;
  canEnable: boolean;
  canDisable: boolean;
  /** El servidor permite encender (INDEPENDENT_MODALITY_ACTIVATION_ALLOWED). Apagar siempre se puede. */
  activationAllowed: boolean;
  history: PlatformModalityHistoryEntry[];
}

export async function listPlatformModalities(token: string): Promise<PlatformModality[]> {
  const result = await apiClient.get<{ modalities: PlatformModality[] }>("/platform/modalities", token);
  return result.modalities.filter((m) => m.code === "INDEPENDENT_PROVIDER");
}

export async function setPlatformModality(code: PlatformModalityCode, enabled: boolean, reason: string, token: string) {
  return apiClient.patch<{ modality: { code: string; enabled: boolean; updatedAt: string }; changed: boolean }>(
    `/platform/modalities/${code}`, { enabled, reason }, token);
}

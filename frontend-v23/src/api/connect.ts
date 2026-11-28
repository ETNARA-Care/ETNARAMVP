import { apiClient } from "./client";

/**
 * 181 · Vínculo con ETNARA Connect. Con la integración apagada en el servidor las rutas responden 404 y el portal no
 * muestra nada. Solo la administración de la organización emite el código (un solo uso, 10 minutos) o desvincula.
 * Las cuentas quedan vinculadas, no fusionadas: Connect recibe solo el estado de la organización, nunca personas.
 */
export interface ConnectLinkStatus { linked: boolean; linkedAt: string | null }
export interface ConnectLinkCode { code: string; expiresAt: string }

export const connectApi = {
  status: (organizationId: string, token: string) => apiClient.get<ConnectLinkStatus>(`/organizations/${organizationId}/connect`, token),
  createCode: (organizationId: string, token: string) => apiClient.post<ConnectLinkCode>(`/organizations/${organizationId}/connect/link-code`, {}, token),
  unlink: (organizationId: string, token: string) => apiClient.post<void>(`/organizations/${organizationId}/connect/unlink`, {}, token),
};

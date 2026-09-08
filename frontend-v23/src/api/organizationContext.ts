import { apiClient } from "./client";

/**
 * Contrato real confirmado en organizationContext.service.ts del backend.
 * GET /me devuelve exactamente estos campos -- nada agregado.
 */
export interface MeUser {
  id: string;
  email: string | null;
  phone: string | null;
}

export interface MeOrganization {
  id: string;
  name: string;
  type: string;
  membershipStatus: string;
  roles: string[];
}

export interface MeResult {
  user: MeUser;
  organizations: MeOrganization[];
}

export function getMe(token: string): Promise<MeResult> {
  return apiClient.get<MeResult>("/me", token);
}

/**
 * OJO: la respuesta real de este endpoint usa `organization_type`
 * (snake_case), NO `type` como en la lista de /me -- inconsistencia real
 * del backend (organizationContext.service.ts, validateOrganizationSelection),
 * no un error de transcripción. No la "corregimos" aquí; la reflejamos tal
 * cual. La app usa el objeto de `organizations` (de /me) como fuente de
 * verdad de la organización activa -- esta respuesta solo confirma que la
 * selección fue aceptada por el backend.
 */
export interface ActiveOrganizationResult {
  organization: {
    id: string;
    name: string;
    organization_type: string;
  };
}

export function setActiveOrganization(organizationId: string, token: string): Promise<ActiveOrganizationResult> {
  return apiClient.post<ActiveOrganizationResult>("/me/active-organization", { organizationId }, token);
}

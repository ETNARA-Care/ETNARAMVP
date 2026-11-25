import { apiClient } from "./client";

/** 170 · Panel base del hogar: solo recuentos administrativos y el estado de los interruptores de hogar. */
export interface ResidentialOverview {
  establishments: number;
  activeResidents: number;
  planResidentLimit: number;
  overPlanLimit: boolean;
  features: Array<{ code: "HOGAR_CALENDARIO" | "HOGAR_ASIGNACIONES" | "HOGAR_PONCHES" | "DEMO_ENVIRONMENT"; enabled: boolean }>;
}

export function getResidentialOverview(organizationId: string, token: string): Promise<{ overview: ResidentialOverview }> {
  return apiClient.get(`/organizations/${organizationId}/residential/overview`, token);
}

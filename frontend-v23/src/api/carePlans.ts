import { apiClient } from "./client";

export type CarePlanSupportLevel = "LOW" | "MODERATE" | "HIGH" | "COMPLEX";
export type CarePlanTaskCategory =
  | "MEAL"
  | "HYDRATION"
  | "HYGIENE"
  | "MOBILITY"
  | "MEDICATION_REMINDER"
  | "COMPANIONSHIP"
  | "SAFETY"
  | "OTHER";
export type CarePlanTaskFrequency = "EVERY_SHIFT" | "DAILY" | "SPECIFIC_DAYS" | "AS_NEEDED";
export type CarePlanTaskPriority = "ROUTINE" | "IMPORTANT" | "CRITICAL";

export interface CarePlanTask {
  id: string;
  title: string;
  details?: string;
  category: CarePlanTaskCategory;
  frequency: CarePlanTaskFrequency;
  timeOfDay?: string;
  priority: CarePlanTaskPriority;
  requiresConfirmation: boolean;
}

export interface CarePlanDetails {
  supportLevel: CarePlanSupportLevel;
  goals: string[];
  instructions: string[];
  precautions: string[];
  tasks: CarePlanTask[];
}

export interface CarePlan {
  id: string;
  organization_id: string;
  care_recipient_id: string;
  version: number;
  plan_details: CarePlanDetails;
  effective_from: string;
  effective_to: string | null;
  status: "active" | "superseded";
  created_at: string;
  created_by_user_id: string | null;
}

export type SaveCarePlanInput = Omit<CarePlanDetails, "tasks"> & {
  tasks: Array<Omit<CarePlanTask, "id"> & { id?: string }>;
};

export async function getActiveCarePlan(
  organizationId: string,
  recipientId: string,
  token: string,
): Promise<CarePlan | null> {
  const result = await apiClient.get<{ carePlan: CarePlan | null }>(
    `/organizations/${organizationId}/care-recipients/${recipientId}/care-plan`,
    token,
  );
  return result.carePlan;
}

export async function saveCarePlan(
  organizationId: string,
  recipientId: string,
  input: SaveCarePlanInput,
  token: string,
): Promise<CarePlan> {
  const result = await apiClient.post<{ carePlan: CarePlan }>(
    `/organizations/${organizationId}/care-recipients/${recipientId}/care-plan`,
    input,
    token,
  );
  return result.carePlan;
}

export const supportLevelLabels: Record<CarePlanSupportLevel, string> = {
  LOW: "Apoyo bajo",
  MODERATE: "Apoyo moderado",
  HIGH: "Apoyo alto",
  COMPLEX: "Cuidado complejo",
};

export const taskCategoryLabels: Record<CarePlanTaskCategory, string> = {
  MEAL: "Alimentación",
  HYDRATION: "Hidratación",
  HYGIENE: "Higiene",
  MOBILITY: "Movilidad",
  MEDICATION_REMINDER: "Recordatorio de medicamentos",
  COMPANIONSHIP: "Compañía",
  SAFETY: "Seguridad",
  OTHER: "Otra",
};

export const taskFrequencyLabels: Record<CarePlanTaskFrequency, string> = {
  EVERY_SHIFT: "Cada turno",
  DAILY: "Diaria",
  SPECIFIC_DAYS: "Días específicos",
  AS_NEEDED: "Según necesidad",
};

import { apiClient } from "./client";

export type CareQualitySeverity = "critical" | "warning" | "info";

export interface CareQualityPriority {
  rank: number;
  key: string;
  entityType: "shift" | "observation" | "incident";
  entityId: string;
  severity: CareQualitySeverity;
  title: string;
  detail: string;
  reason: string;
  recommendedAction: string;
  actionPath: string;
  occurredAt: string;
  requiresHumanConfirmation: true;
}

export interface CareQualityAgentBriefing {
  runId: string;
  generatedAt: string;
  mode: "advisory";
  headline: string;
  narrative: string;
  summary: {
    reviewedShifts: number;
    shiftsNeedingReview: number;
    openObservations: number;
    incidentsWithoutFollowUp: number;
  };
  priorities: CareQualityPriority[];
  guardrails: string[];
}

export const generateCareQualityAgentBriefing = (
  organizationId: string,
  token: string,
) => apiClient.post<CareQualityAgentBriefing>(
  `/organizations/${organizationId}/care-quality/agent/briefing`,
  {},
  token,
);

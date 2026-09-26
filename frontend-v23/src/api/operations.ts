import { apiClient } from "./client";

export type OperationalSeverity = "critical" | "warning" | "info";
export type OperationalCategory =
  | "uncovered_shift"
  | "missed_check_in"
  | "expiring_credential"
  | "open_incident"
  | "pending_timesheet";

export interface OperationalAlert {
  key: string;
  category: OperationalCategory;
  severity: OperationalSeverity;
  title: string;
  detail: string;
  relatedEntityType: string;
  relatedEntityId: string;
  actionPath: string;
  occurredAt: string;
  escalatedAt: string | null;
}

export interface OperationsCenter {
  generatedAt: string;
  summary: { total: number; critical: number; warning: number; info: number };
  alerts: OperationalAlert[];
}

export interface OperationsAgentPriority {
  rank: number;
  alertKey: string;
  category: OperationalCategory;
  severity: OperationalSeverity;
  title: string;
  detail: string;
  reason: string;
  recommendedAction: string;
  actionPath: string;
  requiresHumanConfirmation: true;
}

export interface OperationsAgentBriefing {
  runId: string;
  generatedAt: string;
  mode: "advisory";
  headline: string;
  narrative: string;
  priorities: OperationsAgentPriority[];
  guardrails: string[];
}

export const getOperationsCenter = (organizationId: string, token: string) =>
  apiClient.get<OperationsCenter>(
    `/organizations/${organizationId}/operations/center`,
    token
  );

export const generateOperationsAgentBriefing = (
  organizationId: string,
  token: string
) =>
  apiClient.post<OperationsAgentBriefing>(
    `/organizations/${organizationId}/operations/agent/briefing`,
    {},
    token
  );

export const escalateOperationalAlert = (
  organizationId: string,
  alert: OperationalAlert,
  token: string
) =>
  apiClient.post(
    `/organizations/${organizationId}/operations/escalate`,
    {
      alertKey: alert.key,
      category: alert.category,
      relatedEntityType: alert.relatedEntityType,
      relatedEntityId: alert.relatedEntityId,
    },
    token
  );

import { apiClient } from "./client";

export type CoverageAgentSeverity = "critical" | "warning";

export interface CoverageAgentPriority {
  rank: number;
  shiftId: string;
  recipientName: string;
  scheduledStart: string;
  scheduledEnd: string;
  requiredRole: string;
  severity: CoverageAgentSeverity;
  eligibleCandidateCount: number;
  campaignStatus: "open" | "closed" | "cancelled" | "exhausted" | null;
  currentWave: number | null;
  interestedCount: number;
  pendingCount: number;
  queuedCount: number;
  reason: string;
  recommendedAction: string;
  actionPath: string;
  requiresHumanConfirmation: true;
}

export interface CoverageAgentBriefing {
  runId: string;
  generatedAt: string;
  mode: "advisory";
  headline: string;
  narrative: string;
  summary: {
    uncoveredShifts: number;
    urgentShifts: number;
    actionableShifts: number;
  };
  priorities: CoverageAgentPriority[];
  guardrails: string[];
}

export const generateCoverageAgentBriefing = (
  organizationId: string,
  token: string,
) => apiClient.post<CoverageAgentBriefing>(
  `/organizations/${organizationId}/coverage/agent/briefing`,
  {},
  token,
);

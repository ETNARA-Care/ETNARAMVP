import { apiClient } from "./client";

export type WorkforceRisk = "stable" | "watch" | "high" | "critical";

export interface RoleForecast {
  role: string;
  requiredMinutes: number;
  knownAvailableMinutes: number;
  coverageGapMinutes: number;
  totalShifts: number;
  uncoveredShifts: number;
  eligibleWorkers: number;
  unknownAvailabilityWorkers: number;
}

export interface DailyWorkforceForecast {
  date: string;
  risk: WorkforceRisk;
  requiredMinutes: number;
  knownAvailableMinutes: number;
  coverageGapMinutes: number;
  totalShifts: number;
  uncoveredShifts: number;
  unknownAvailabilityWorkers: number;
  roles: RoleForecast[];
  explanations: string[];
  recommendedActions: string[];
}

export interface CredentialRisk {
  membershipId: string;
  displayName: string | null;
  internalRole: string;
  credentialTypeCode: string;
  expiresAt: string;
}

export interface WorkforceForecast {
  startDate: string;
  horizonDays: number;
  timezone: string;
  generatedAt: string;
  summary: {
    highRiskDays: number;
    uncoveredShifts: number;
    eligibleWorkers: number;
    workersWithoutAvailability: number;
    credentialRisks: number;
  };
  assistantSummary: string[];
  credentialRisks: CredentialRisk[];
  days: DailyWorkforceForecast[];
}

export async function getWorkforceForecast(
  organizationId: string,
  input: { startDate: string; days: 7 | 14 | 30; timezone: string },
  token: string,
): Promise<WorkforceForecast> {
  const query = new URLSearchParams({
    startDate: input.startDate,
    days: String(input.days),
    timezone: input.timezone,
  });
  const result = await apiClient.get<{ forecast: WorkforceForecast }>(
    `/organizations/${organizationId}/workforce/forecast?${query.toString()}`,
    token,
  );
  return result.forecast;
}

import { apiClient } from "./client";

export interface WeeklyAvailabilityWindow {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface UnavailablePeriod {
  id?: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface MyAvailability {
  configured: boolean;
  timezone: "America/Puerto_Rico";
  weeklyWindows: WeeklyAvailabilityWindow[];
  unavailablePeriods: UnavailablePeriod[];
}

export async function getMyAvailability(organizationId: string, token: string): Promise<MyAvailability> {
  const result = await apiClient.get<{ availability: MyAvailability }>(
    `/organizations/${organizationId}/me/availability`,
    token,
  );
  return result.availability;
}

export async function saveMyAvailability(
  organizationId: string,
  input: Pick<MyAvailability, "timezone" | "weeklyWindows" | "unavailablePeriods">,
  token: string,
): Promise<MyAvailability> {
  const result = await apiClient.put<{ availability: MyAvailability }>(
    `/organizations/${organizationId}/me/availability`,
    input,
    token,
  );
  return result.availability;
}

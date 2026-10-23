import { apiClient } from "./client";

/** Gate 7 «ETNARA En Camino»: declared departure and delays. No GPS, no ETA. */
export type JourneyStateName = "UNASSIGNED" | "PENDING_ACCEPTANCE" | "ASSIGNED" | "EN_ROUTE" | "ARRIVED" | "IN_SERVICE" | "COMPLETED" | "CANCELLED";
export type DelayReason = "TRAFFIC" | "PREVIOUS_SERVICE" | "TRANSPORT" | "WEATHER" | "OTHER";
export const DELAY_MINUTES = [10, 15, 30, 45, 60] as const;
export type DelayMinutes = (typeof DELAY_MINUTES)[number];
export interface Journey {
  state: JourneyStateName;
  enRouteAt: string | null;
  /** Declared by the caregiver: never an estimated arrival time. */
  delay: { minutes: number; reason: DelayReason; reportedAt: string } | null;
  arrivedAt: string | null;
  /** Agency and caregiver only; families never receive it. */
  arrivalNeedsReview?: boolean;
  startedAt: string | null;
  finishedAt: string | null;
}
export interface JourneyHistoryItem { at: string; kind: string; detail?: Record<string, unknown> }
export type JourneyRisk = "NOT_EN_ROUTE" | "LATE_ARRIVAL" | "DELAY_30";
export interface TodayJourney {
  shiftId: string; scheduledStart: string; scheduledEnd: string; recipient: string | null; caregiver: string | null;
  journey: Journey; risks: JourneyRisk[];
}

const J = (o: string, s: string) => `/organizations/${o}/shifts/${s}/journey`;
export const getShiftJourney = (o: string, s: string, t: string) =>
  apiClient.get<{ journey: Journey; history?: JourneyHistoryItem[] }>(J(o, s), t);
export const declareEnRoute = (o: string, s: string, t: string) =>
  apiClient.post<{ journey: Journey }>(`${J(o, s)}/en-route`, { clientEventId: crypto.randomUUID() }, t);
export const reportDelay = (o: string, s: string, minutes: DelayMinutes, reason: DelayReason, t: string) =>
  apiClient.post<{ journey: Journey }>(`${J(o, s)}/delay`, { minutes, reason, clientEventId: crypto.randomUUID() }, t);
export const listTodayJourneys = async (o: string, t: string) =>
  (await apiClient.get<{ journeys: TodayJourney[] }>(`/organizations/${o}/operations/journeys`, t)).journeys;

import { apiClient } from "./client";

export interface MyCoverageOffer {
  id: string;
  campaignId: string;
  scheduledStart: string;
  scheduledEnd: string;
  roleLabel: string;
  responseStatus: "pending" | "interested" | "declined";
  expiresAt: string;
  candidateRank: number;
  waveNumber: number;
  responseDueAt: string | null;
}

export interface ShiftCoverageOffer {
  id: string;
  displayName: string | null;
  responseStatus: "queued" | "pending" | "interested" | "declined" | "expired" | "withdrawn";
  respondedAt: string | null;
  candidateRank: number;
  waveNumber: number;
  responseDueAt: string | null;
  campaignStatus: "open" | "closed" | "cancelled" | "exhausted";
  currentWave: number;
  nextWaveAt: string | null;
  waveSize: number;
  totalCandidates: number;
}

export async function openCoverageCampaign(organizationId: string, shiftId: string, token: string) {
  const result = await apiClient.post<{ campaign: {
    id: string; offerCount: number; totalCandidates: number; currentWave: number; nextWaveAt: string; expiresAt: string;
  } }>(
    `/organizations/${organizationId}/shifts/${shiftId}/coverage-campaigns`,
    { waveSize: 3, responseWindowMinutes: 30 }, token,
  );
  return result.campaign;
}

export async function listShiftCoverageOffers(organizationId: string, shiftId: string, token: string): Promise<ShiftCoverageOffer[]> {
  const result = await apiClient.get<{ offers: ShiftCoverageOffer[] }>(`/organizations/${organizationId}/shifts/${shiftId}/coverage-offers`, token);
  return result.offers;
}

export async function listMyCoverageOffers(organizationId: string, token: string): Promise<MyCoverageOffer[]> {
  const result = await apiClient.get<{ offers: MyCoverageOffer[] }>(`/organizations/${organizationId}/me/coverage-offers`, token);
  return result.offers;
}

export async function respondCoverageOffer(organizationId: string, offerId: string, decision: "interested" | "declined", token: string) {
  const result = await apiClient.post<{ offer: { id: string; response_status: string; responded_at: string } }>(
    `/organizations/${organizationId}/me/coverage-offers/${offerId}/respond`, { decision }, token,
  );
  return result.offer;
}

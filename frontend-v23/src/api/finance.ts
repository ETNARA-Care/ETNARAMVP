import { apiClient } from "./client";

/**
 * ETNARA Finanzas F1 (backend migration 119). Agency administrator only and
 * only while ETNARA central has FINANZAS on for the agency (the backend answers
 * 404 FEATURE_NOT_ENABLED otherwise). Money always travels as integer cents.
 */
export type FinanceUnit = "hour" | "shift" | "day" | "fixed";
export type RateKind = "client" | "caregiver";
export type RateScope = "general" | "client" | "caregiver";
export type DayType = "standard" | "holiday";
export type HalfDayPolicy = "review" | "proportional" | "fixed";

/** `negative` (F1.1, backend 121): billed less than paid. A warning, never a block. */
export interface Margin { differenceCents: number; marginBasisPoints: number | null; negative?: boolean }

export interface FinanceService {
  id: string; name: string; description: string | null; unit: FinanceUnit; active: boolean; updated_at: string;
  client_cents: number | null; caregiver_cents: number | null; client_exceptions: number; caregiver_exceptions: number;
  next_change: string | null; margin: Margin | null;
}

export interface FinanceRate {
  id: string; rate_kind: RateKind; scope: RateScope; day_type: DayType; amount_cents: number; currency: string;
  effective_from: string; effective_to: string | null; min_minutes: number | null; rounding_minutes: number | null;
  half_day_policy: HalfDayPolicy | null; half_day_amount_cents: number | null; reason: string | null; end_reason: string | null;
  created_at: string; ended_at: string | null; billing_client_id: string | null; client_name: string | null;
  membership_id: string | null; caregiver_name: string | null; created_by_email: string | null;
  cancelled_at?: string | null; cancel_reason?: string | null; cancelled_by_email?: string | null;
  status: "past" | "current" | "future" | "cancelled";
}

export interface FinanceHistoryEntry { action: string; occurred_at: string; previous_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null; actor_email: string | null }

export interface ServiceRates { today: string; service: { id: string; name: string; unit: FinanceUnit; active: boolean }; rates: FinanceRate[]; history: FinanceHistoryEntry[] }

export interface NewRate {
  rateKind: RateKind; scope: RateScope; billingClientId?: string | null; membershipId?: string | null; dayType: DayType;
  amountCents: number; effectiveFrom?: string; minMinutes?: number | null; roundingMinutes?: number | null;
  halfDayPolicy?: HalfDayPolicy | null; halfDayAmountCents?: number | null; reason?: string;
}

export interface BillingClient {
  id: string; full_name: string; email: string | null; phone: string | null; address: string | null; notes: string | null; active: boolean;
  recipients: Array<{ careRecipientId: string; name: string; isPrimary: boolean }>;
}

export interface CaregiverRates {
  membership_id: string; display_name: string | null; internal_role: string; membership_status: string;
  legacy_pay_rate_cents: number | null; legacy_bill_rate_cents: number | null;
  exceptions: Array<{ rateId: string; serviceId: string; serviceName: string; unit: FinanceUnit; amountCents: number; dayType: DayType; effectiveFrom: string; effectiveTo: string | null }>;
}

export interface FinanceHoliday {
  date: string; name: string; active?: boolean;
  deactivated_at?: string | null; deactivation_reason?: string | null; deactivated_by_email?: string | null;
}

export interface Charge { quantityHundredths: number; amountCents: number; needsReview: boolean; reviewReason: string | null; detail: string }
export interface ResolvedRate { rateId: string; amountCents: number; source: "client" | "caregiver" | "general"; dayType: DayType; effectiveFrom: string }
export interface Resolution {
  service: { id: string; name: string; unit: FinanceUnit; active: boolean };
  date: string; holiday: string | null; billing: ResolvedRate | null; pay: ResolvedRate | null; unitMargin: Margin | null;
  estimate: { minutes: number; billing: Charge | null; pay: Charge | null; margin: Margin | null } | null;
  exceptions: string[];
}

export interface ShiftFinance {
  shiftId: string; serviceDate: string;
  terms: { serviceId: string | null; billingClientId: string | null; authorizedUnitsHundredths: number | null; note: string | null; updatedAt: string | null };
  effective: {
    serviceId: string | null; serviceSource: "shift" | "recipient_default" | null;
    billingClientId: string | null; clientSource: "shift" | "recipient_primary" | null;
    membershipId: string | null; caregiverName: string | null; minutes: number; minutesSource: "approved_timesheet" | "schedule";
  };
  locked: boolean; resolution: Resolution | null; exceptions: string[];
}

const F = (org: string) => `/organizations/${org}/finance`;

export const financeApi = {
  listServices: (org: string, token: string) => apiClient.get<{ today: string; services: FinanceService[] }>(`${F(org)}/services`, token),
  createService: (org: string, body: { name: string; unit: FinanceUnit; description?: string | null }, token: string) =>
    apiClient.post<{ service: FinanceService }>(`${F(org)}/services`, body, token),
  updateService: (org: string, id: string, body: { name?: string; description?: string | null; active?: boolean }, token: string) =>
    apiClient.patch<{ service: FinanceService }>(`${F(org)}/services/${id}`, body, token),
  listRates: (org: string, serviceId: string, token: string) => apiClient.get<ServiceRates>(`${F(org)}/services/${serviceId}/rates`, token),
  createRate: (org: string, serviceId: string, body: NewRate, token: string) =>
    apiClient.post<{ rate: FinanceRate; closedPrevious: FinanceRate | null }>(`${F(org)}/services/${serviceId}/rates`, body, token),
  endRate: (org: string, rateId: string, body: { effectiveTo: string; reason: string }, token: string) =>
    apiClient.post(`${F(org)}/rates/${rateId}/end`, body, token),
  /** F1.1: cancel a price change that has not taken effect yet (reason required); the previous price is restored. */
  cancelRate: (org: string, rateId: string, reason: string, token: string) =>
    apiClient.post<{ rate: FinanceRate; reopened: FinanceRate | null }>(`${F(org)}/rates/${rateId}/cancel`, { reason }, token),
  resolve: (org: string, params: { serviceId: string; date?: string; billingClientId?: string; membershipId?: string; minutes?: number }, token: string) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    return apiClient.get<Resolution>(`${F(org)}/rates/resolve?${q}`, token);
  },
  listCaregivers: (org: string, token: string) => apiClient.get<{ today: string; caregivers: CaregiverRates[] }>(`${F(org)}/caregivers`, token),
  listClients: (org: string, token: string) => apiClient.get<{ clients: BillingClient[] }>(`${F(org)}/clients`, token),
  createClient: (org: string, body: { fullName: string; email?: string | null; phone?: string | null; address?: string | null; notes?: string | null }, token: string) =>
    apiClient.post<{ client: BillingClient }>(`${F(org)}/clients`, body, token),
  updateClient: (org: string, id: string, body: Partial<{ fullName: string; email: string | null; phone: string | null; address: string | null; notes: string | null; active: boolean }>, token: string) =>
    apiClient.patch(`${F(org)}/clients/${id}`, body, token),
  linkRecipient: (org: string, clientId: string, body: { careRecipientId: string; isPrimary: boolean }, token: string) =>
    apiClient.post(`${F(org)}/clients/${clientId}/recipients`, body, token),
  listHolidays: (org: string, token: string) => apiClient.get<{ holidays: FinanceHoliday[] }>(`${F(org)}/holidays`, token),
  /** Adding a date that was deactivated reactivates it (F1.1). */
  addHoliday: (org: string, body: { date: string; name: string }, token: string) => apiClient.post(`${F(org)}/holidays`, body, token),
  /** F1.1: a holiday added by mistake is deactivated with a reason, never deleted. */
  deactivateHoliday: (org: string, date: string, reason: string, token: string) =>
    apiClient.post(`${F(org)}/holidays/${date}/deactivate`, { reason }, token),
  setRecipientDefaults: (org: string, recipientId: string, serviceId: string | null, token: string) =>
    apiClient.put(`${F(org)}/recipients/${recipientId}/defaults`, { serviceId }, token),
  getShift: (org: string, shiftId: string, token: string) => apiClient.get<ShiftFinance>(`/organizations/${org}/shifts/${shiftId}/finance`, token),
  setShift: (org: string, shiftId: string, body: { serviceId: string | null; billingClientId?: string | null; authorizedUnitsHundredths?: number | null; note?: string | null }, token: string) =>
    apiClient.put<ShiftFinance>(`/organizations/${org}/shifts/${shiftId}/finance`, body, token),
};

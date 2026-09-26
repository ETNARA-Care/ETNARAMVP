import { apiFetch } from "./client";

export interface FinancialRate {
  membership_id: string; display_name: string | null; internal_role: string; membership_status: string;
  pay_rate_cents: number | null; bill_rate_cents: number | null; currency: string | null; updated_at: string | null;
}
export interface Timesheet {
  id: string; organization_worker_membership_id: string; worker_name: string | null; worker_role: string;
  recipient_name: string | null; check_in_at: string; check_out_at: string; recorded_minutes: number;
  approved_minutes: number | null; pay_amount_cents: number | null; bill_amount_cents: number | null;
  status: "pending" | "approved" | "disputed"; review_note: string | null; currency: string;
}
export interface TimesheetSummary {
  recordedMinutes: number; approvedMinutes: number; pendingCount: number; disputedCount: number;
  approvedPayCents: number; approvedBillCents: number;
}
export async function listFinancialRates(organizationId: string) {
  return (await apiFetch<{rates: FinancialRate[]}>(`/organizations/${organizationId}/financial-rates`)).rates;
}
export async function saveFinancialRate(organizationId: string, membershipId: string, payRateCents: number, billRateCents: number) {
  return apiFetch(`/organizations/${organizationId}/financial-rates/${membershipId}`, {method:"PUT", body:{payRateCents,billRateCents,currency:"USD"}});
}
export async function listTimesheets(organizationId: string, dateFrom: string, dateTo: string, status?: string) {
  return apiFetch<{timesheets: Timesheet[]; summary: TimesheetSummary}>(`/organizations/${organizationId}/timesheets`, {query:{dateFrom,dateTo,status}});
}
export async function reviewTimesheet(organizationId: string, timesheetId: string, decision: "approved"|"disputed", approvedMinutes?: number, note?: string) {
  return apiFetch(`/organizations/${organizationId}/timesheets/${timesheetId}/review`, {method:"POST", body:{decision,approvedMinutes,note}});
}

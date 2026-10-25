import { apiClient } from "./client";

/**
 * Facturación Premium F2.1 (backend migration 123). FACTURACION is a separate
 * premium switch that needs FINANZAS; only ETNARA central changes it. Agency
 * administrators hold separate capabilities; the backend and the database
 * decide every action (the portal only hides what the backend would refuse).
 */
export type BillingCapability = "view" | "draft" | "issue" | "void" | "manage";
export const BILLING_CAPABILITIES: BillingCapability[] = ["view", "draft", "issue", "void", "manage"];
export type BillingGrantSource = "manual" | "initial_single_admin" | "central_designation";

export interface BillingModuleState { finanzas: boolean; facturacion: boolean; enabled: boolean; readOnly: boolean }
export interface BillingAccess { module: BillingModuleState; capabilities: BillingCapability[] }

export interface BillingAdmin { membershipId: string; email: string; isMe: boolean; capabilities: BillingCapability[] }
export interface BillingGrant {
  id: string; membership_id: string; capability: BillingCapability; grant_source: BillingGrantSource; grant_reason: string;
  granted_at: string; granted_by_email: string | null; revoked_at: string | null; revoke_reason: string | null; revoked_by_email: string | null;
}
export interface BillingPermissions { module: BillingModuleState; canManage: boolean; admins: BillingAdmin[]; history: BillingGrant[] }

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}/billing`;

export const billingApi = {
  access: (organizationId: string, token: string) => apiClient.get<BillingAccess>(`${base(organizationId)}/access`, token),
  permissions: (organizationId: string, token: string) => apiClient.get<BillingPermissions>(`${base(organizationId)}/permissions`, token),
  grant: (organizationId: string, body: { membershipId: string; capability: BillingCapability; reason: string }, token: string) =>
    apiClient.post<{ permission: { id: string } }>(`${base(organizationId)}/permissions`, body, token),
  revoke: (organizationId: string, permissionId: string, reason: string, token: string) =>
    apiClient.post<{ permission: { id: string } }>(`${base(organizationId)}/permissions/${encodeURIComponent(permissionId)}/revoke`, { reason }, token),
};

// ---------------------------------------------------------------------------
// F2.2 (backend 124): tax treatment, drafts, lines and shift reservations.
// Issuing does not exist yet (F2.3): drafts report what would block it.

export type TaxTreatment = "taxable" | "exempt" | "pending";
export interface TaxVersion { id: string; service_id: string; treatment: TaxTreatment; rate_basis_points: number | null; legal_basis: string | null; validation_note: string | null; effective_from: string; created_at: string; created_by_email: string | null }
export interface TaxService { id: string; name: string; unit: string; active: boolean; current: { treatment: TaxTreatment; rate_basis_points: number | null; legal_basis: string | null; effective_from: string | null }; versions: TaxVersion[] }

export interface BillingClientOption { id: string; name: string; recipients: { id: string; name: string | null }[] }
export interface BillingServiceOption { id: string; name: string; unit: string }

export interface SegmentRateInfo { rateId: string; amountCents: number; source: "client" | "general"; dayType: "standard" | "holiday"; holiday: string | null }
export interface PricedSegment { date: string; startsAt: string; endsAt: string; minutes: number; billableMinutes: number; rate: SegmentRateInfo | null; amountCents: number }
export interface EligibleShift {
  shiftId: string; serviceDate: string; recipientName: string | null; caregiverName: string | null; serviceId: string | null; serviceName: string | null; unit: string | null;
  realStart: string | null; realEnd: string | null; approvedMinutes: number | null;
  reservedBy: { invoiceId: string; email: string; at: string } | null;
  exceptions: string[]; warnings: { code: string; minutes?: number }[]; amountCents: number | null; segments: PricedSegment[];
  taxTreatment: TaxTreatment; selectable: boolean;
}

export type InvoiceStatus = "draft" | "discarded";
export interface InvoiceSummary {
  id: string; status: InvoiceStatus; clientName: string; periodFrom: string; periodTo: string; version: number; createdAt: string; updatedAt: string;
  createdByEmail: string | null; lineCount: number; subtotalCents: number; taxPending: boolean; needsReview: boolean; inactive: boolean; discardKind: string | null;
}
export interface StoredSegment { line_id: string; segment_date: string; starts_at: string; ends_at: string; minutes: number; billable_minutes: number; rate_source: string | null; day_type: string | null; holiday_name: string | null; unit_price_cents: number | null; amount_cents: number }
export interface InvoiceLine {
  id: string; kind: "shift" | "manual" | "discount"; shift_id: string | null; care_recipient_id: string | null; recipient_name: string | null; service_id: string | null;
  description: string; justification: string | null; service_date: string; real_start: string | null; real_end: string | null; approved_minutes: number | null;
  unit: string | null; quantity_hundredths: number; unit_price_cents: number | null; amount_cents: number; tax_treatment: TaxTreatment; tax_rate_basis_points: number | null;
  tax_legal_basis: string | null; needs_review: boolean; review_reasons: string[]; warnings: { code: string; minutes?: number }[]; position: number;
  rateChanged: boolean; segments: StoredSegment[];
}
export interface InvoiceTotals {
  subtotalCents: number; taxes: { rateBasisPoints: number; baseCents: number; taxCents: number; negativeBase: boolean }[];
  exemptBaseCents: number; pendingBaseCents: number; taxCents: number; totalCents: number; taxPending: boolean; negativeTotal: boolean;
}
export interface InvoiceDetail {
  invoice: { id: string; status: InvoiceStatus; billingClientId: string; clientName: string; periodFrom: string; periodTo: string; notes: string | null; version: number;
    createdAt: string; updatedAt: string; createdByEmail: string | null; discardedAt: string | null; discardReason: string | null; discardKind: string | null; inactive: boolean; inactiveDays: number };
  lines: InvoiceLine[];
  removedLines: { id: string; kind: string; description: string; amountCents: number; removedAt: string; reason: string | null }[];
  totals: InvoiceTotals; issueBlockers: string[]; canEdit: boolean;
}
export interface ManualLineInput {
  expectedVersion: number; kind: "manual" | "discount"; description: string; justification: string; serviceId?: string | null; careRecipientId?: string | null;
  serviceDate: string; quantityHundredths: number; unitPriceCents: number; taxTreatment: TaxTreatment; taxRateBasisPoints?: number | null; taxLegalBasis?: string | null;
}

const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();
export const billingDraftsApi = {
  tax: (org: string, token: string) => apiClient.get<{ today: string; services: TaxService[] }>(`${base(org)}/tax`, token),
  setTax: (org: string, body: { serviceId: string; treatment: TaxTreatment; rateBasisPoints?: number | null; legalBasis?: string | null; validationNote?: string | null; effectiveFrom: string }, token: string) =>
    apiClient.post<{ tax: { id: string } }>(`${base(org)}/tax`, body, token),
  clients: (org: string, token: string) => apiClient.get<{ clients: BillingClientOption[]; services: BillingServiceOption[] }>(`${base(org)}/clients`, token),
  eligible: (org: string, p: { billingClientId: string; from: string; to: string }, token: string) =>
    apiClient.get<{ shifts: EligibleShift[] }>(`${base(org)}/eligible-shifts?${qs(p)}`, token),
  list: (org: string, token: string) => apiClient.get<{ inactiveDays: number; invoices: InvoiceSummary[] }>(`${base(org)}/invoices`, token),
  create: (org: string, body: { billingClientId: string; periodFrom: string; periodTo: string; notes?: string }, token: string) =>
    apiClient.post<{ invoice: { id: string } }>(`${base(org)}/invoices`, body, token),
  get: (org: string, id: string, token: string) => apiClient.get<InvoiceDetail>(`${base(org)}/invoices/${encodeURIComponent(id)}`, token),
  update: (org: string, id: string, body: { expectedVersion: number; periodFrom?: string; periodTo?: string; notes?: string | null }, token: string) =>
    apiClient.patch<{ ok: true }>(`${base(org)}/invoices/${encodeURIComponent(id)}`, body, token),
  addShifts: (org: string, id: string, body: { expectedVersion: number; shiftIds: string[] }, token: string) =>
    apiClient.post<{ added: string[] }>(`${base(org)}/invoices/${encodeURIComponent(id)}/shift-lines`, body, token),
  addManual: (org: string, id: string, body: ManualLineInput, token: string) =>
    apiClient.post<{ id: string; warnings: { code: string }[] }>(`${base(org)}/invoices/${encodeURIComponent(id)}/manual-lines`, body, token),
  removeLine: (org: string, id: string, lineId: string, body: { expectedVersion: number; reason?: string }, token: string) =>
    apiClient.post<{ released: number }>(`${base(org)}/invoices/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}/remove`, body, token),
  recalculate: (org: string, id: string, body: { expectedVersion: number }, token: string) =>
    apiClient.post<{ changed: number }>(`${base(org)}/invoices/${encodeURIComponent(id)}/recalculate`, body, token),
  discard: (org: string, id: string, body: { expectedVersion: number; reason: string }, token: string) =>
    apiClient.post<{ released: number }>(`${base(org)}/invoices/${encodeURIComponent(id)}/discard`, body, token),
  recover: (org: string, id: string, body: { expectedVersion: number; reason: string }, token: string) =>
    apiClient.post<{ released: number }>(`${base(org)}/invoices/${encodeURIComponent(id)}/recover`, body, token),
};

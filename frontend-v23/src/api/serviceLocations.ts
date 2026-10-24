import { apiClient, type ApiError } from "./client";

/** Gate 6: official service location (backend migration 100, on care_recipient_locations). */
export interface ServiceLocation {
  id: string;
  label: string;
  isPrimary: boolean;
  addressLine: string | null;
  municipality: string | null;
  postalCode: string | null;
  accessNotes: string | null;
  latitude: number | null;
  longitude: number | null;
  establishment: { id: string; name: string; address: string | null } | null;
  /** The agency checked the WRITTEN address. */
  verifiedAt: string | null;
  /** The agency explicitly confirmed the exact map point (Gate 6 fix). */
  gpsConfirmedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
  createdAt: string;
  upcomingShiftCount?: number;
}
export interface UpcomingShift { id: string; scheduledStart: string; scheduledEnd: string; status: string; locationId: string | null }
export interface ServiceLocationsResponse {
  locations: ServiceLocation[];
  upcomingShifts: UpcomingShift[];
  establishment: { id: string; name: string; address: string | null } | null;
}
export interface LocationInput {
  label?: string;
  addressLine?: string | null;
  municipality?: string | null;
  postalCode?: string | null;
  accessNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  establishmentId?: string | null;
}
export interface LocationEvent {
  id: string; location_id: string; event_type: "CREATED" | "UPDATED" | "VERIFIED" | "PRIMARY_SET" | "ARCHIVED" | "RESTORED" | "GPS_CONFIRMED" | "GPS_CHANGED";
  occurred_at: string; actor_user_id: string | null;
  previous: Record<string, unknown> | null; current: Record<string, unknown>;
}
export interface LocationAccess { location_id: string; shift_id: string; user_id: string; accessed_on: string; first_access_at: string; display_name: string | null }
export interface ChangeRequest {
  id: string; status: "PENDING" | "APPROVED" | "REJECTED";
  proposed_address_line: string | null; proposed_municipality: string | null; proposed_postal_code: string | null;
  proposed_access_notes: string | null; message: string | null; resolution_note: string | null;
  resolved_at: string | null; created_at: string; relationship_type?: string;
}
export interface FamilyPermission { id: string; relationship_type: string; is_primary_contact: boolean; can_view_service_location: boolean }
export interface ShiftLocationOption { id: string; label: string; isPrimary: boolean; verified: boolean; gpsConfirmed: boolean; summary: string }
/** What a caregiver (or manager) gets for one shift. */
export interface ShiftServiceLocation {
  id: string; label: string; addressLine: string | null; municipality: string | null; postalCode: string | null;
  accessNotes: string | null; latitude: number | null; longitude: number | null;
  establishment: { id: string; name: string; address: string | null } | null; verified: boolean;
  /** Coordinates are only sent when the agency confirmed them; otherwise navigation is approximate. */
  gpsConfirmed: boolean;
}
export interface FamilyServiceLocation {
  canView: boolean;
  location: { label: string; addressLine: string | null; municipality: string | null; postalCode: string | null;
    establishment: { name: string; address: string | null } | null; verified: boolean } | null;
}

const rec = (o: string, r: string) => `/organizations/${o}/care-recipients/${r}`;

export const listServiceLocations = (o: string, r: string, t: string) => apiClient.get<ServiceLocationsResponse>(`${rec(o, r)}/service-locations`, t);
export const createServiceLocation = (o: string, r: string, input: LocationInput & { makePrimary?: boolean }, t: string) =>
  apiClient.post<{ location: ServiceLocation; shiftsOnOtherAddresses: string[] }>(`${rec(o, r)}/service-locations`, input, t);
export const updateServiceLocation = (o: string, r: string, id: string, input: LocationInput, t: string) =>
  apiClient.patch<{ location: ServiceLocation; upcomingShiftsUsingIt: number }>(`${rec(o, r)}/service-locations/${id}`, input, t);
export const setPrimaryLocation = (o: string, r: string, id: string, t: string) =>
  apiClient.post<{ shiftsOnOtherAddresses: string[] }>(`${rec(o, r)}/service-locations/${id}/primary`, {}, t);
export const verifyLocation = (o: string, r: string, id: string, t: string) => apiClient.post(`${rec(o, r)}/service-locations/${id}/verify`, {}, t);
/** Explicit confirmation of the exact point (managers only; who/when recorded). */
export const confirmLocationGps = (o: string, r: string, id: string, point: { latitude: number; longitude: number }, t: string) =>
  apiClient.post<{ location: ServiceLocation }>(`${rec(o, r)}/service-locations/${id}/confirm-gps`, { ...point, confirm: true }, t);
export const archiveLocation = (o: string, r: string, id: string, t: string) => apiClient.post(`${rec(o, r)}/service-locations/${id}/archive`, {}, t);
export const reassignShifts = (o: string, r: string, shiftIds: string[], toLocationId: string, t: string) =>
  apiClient.post<{ movedShiftIds: string[] }>(`${rec(o, r)}/service-locations/reassign-shifts`, { shiftIds, toLocationId }, t);
export const locationHistory = (o: string, r: string, t: string) =>
  apiClient.get<{ events: LocationEvent[]; access: LocationAccess[] }>(`${rec(o, r)}/service-locations/history`, t);
export const shiftLocationOptions = async (o: string, r: string, t: string) =>
  (await apiClient.get<{ options: ShiftLocationOption[] }>(`${rec(o, r)}/service-location-options`, t)).options;
export const listChangeRequests = async (o: string, r: string, t: string) =>
  (await apiClient.get<{ requests: ChangeRequest[] }>(`${rec(o, r)}/location-change-requests`, t)).requests;
export const resolveChangeRequest = (o: string, r: string, id: string, body: { decision: "APPROVE" | "REJECT"; note?: string; confirmUpcomingShifts?: true }, t: string) =>
  apiClient.post(`${rec(o, r)}/location-change-requests/${id}/resolve`, body, t);
export const listFamilyPermissions = async (o: string, r: string, t: string) =>
  (await apiClient.get<{ relatives: FamilyPermission[] }>(`${rec(o, r)}/family-location-permissions`, t)).relatives;
export const setFamilyPermission = (o: string, r: string, relId: string, canView: boolean, t: string) =>
  apiClient.put(`${rec(o, r)}/family-location-permissions/${relId}`, { canViewServiceLocation: canView }, t);

/** Address of a shift; null when there is none or no access (assignment ended). */
export async function getShiftServiceLocation(o: string, shiftId: string, t: string): Promise<ShiftServiceLocation | null> {
  try {
    return (await apiClient.get<{ location: ShiftServiceLocation | null }>(`/organizations/${o}/shifts/${shiftId}/service-location`, t)).location;
  } catch (e) {
    if ((e as ApiError).status === 404) return null;
    throw e;
  }
}

export const getFamilyServiceLocation = (r: string, t: string) => apiClient.get<FamilyServiceLocation>(`/me/care-recipients/${r}/service-location`, t);
export const listMyChangeRequests = async (r: string, t: string) =>
  (await apiClient.get<{ requests: ChangeRequest[] }>(`/me/care-recipients/${r}/location-change-requests`, t)).requests;
export const createChangeRequest = (r: string, body: { addressLine?: string; municipality?: string; postalCode?: string; accessNotes?: string; message?: string }, t: string) =>
  apiClient.post<{ request: ChangeRequest }>(`/me/care-recipients/${r}/location-change-requests`, body, t);

// ------------------------------------------------------------------ arrival (Llegué)
export type Proximity = "NEAR" | "FAR" | "NO_CONSENT" | "UNAVAILABLE" | "NO_REFERENCE";
export interface Arrival { occurredAt: string; proximity: Proximity; distanceM: number | null; needsReview: boolean }
export const LOCATION_CONSENT_VERSION = "location-check-v1";
export const getLocationConsent = (o: string, t: string) =>
  apiClient.get<{ granted: boolean; consentVersion: string | null; grantedAt: string | null }>(`/organizations/${o}/me/location-consent`, t);
export const grantLocationConsent = (o: string, t: string) =>
  apiClient.post(`/organizations/${o}/me/location-consent`, { consentVersion: LOCATION_CONSENT_VERSION }, t);
export const revokeLocationConsent = (o: string, t: string) => apiClient.delete(`/organizations/${o}/me/location-consent`, t);
/** One reading at most; omitted when there is no consent or no GPS. */
export async function recordArrival(o: string, shiftId: string, reading: { latitude: number; longitude: number; accuracyM?: number } | null, t: string) {
  return (await apiClient.post<{ arrival: Arrival }>(`/organizations/${o}/shifts/${shiftId}/arrival`, {
    ...(reading ? { latitude: reading.latitude, longitude: reading.longitude, ...(reading.accuracyM !== undefined ? { accuracyM: reading.accuracyM } : {}) } : {}),
    clientEventId: crypto.randomUUID(),
  }, t)).arrival;
}
export const reviewArrival = (o: string, shiftId: string, membershipId: string, note: string, t: string) =>
  apiClient.post(`/organizations/${o}/shifts/${shiftId}/arrival/review`, { membershipId, note }, t);

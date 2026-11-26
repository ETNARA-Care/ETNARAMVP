import i18n from "@/i18n";
import { apiClient } from "./client";

/** 170 · Panel base del hogar: solo recuentos administrativos y el estado de los interruptores de hogar. */
export interface ResidentialOverview {
  establishments: number;
  activeResidents: number;
  planResidentLimit: number;
  overPlanLimit: boolean;
  features: Array<{ code: "HOGAR_CALENDARIO" | "HOGAR_ASIGNACIONES" | "HOGAR_PONCHES" | "DEMO_ENVIRONMENT"; enabled: boolean }>;
  /** 177 (F5): panel completo. Ocupación siempre; asistencia con HOGAR_PONCHES y asignaciones con HOGAR_ASIGNACIONES (si no, null). */
  panel?: ResidentialPanel;
}
export interface ResidentialPanel {
  occupancy: ResidentialOccupancy & { establishments: Array<{ id: string; name: string } & Partial<ResidentialOccupancy>> };
  attendance: { present: Array<{ workerName: string | null; establishment: string; since: string }>; pendingReview: number; openAlerts: number } | null;
  assignments: { ongoingShifts: number; uncovered: Array<{ careRecipientId: string; name: string; establishment: string }>; openCoverageAlerts: number } | null;
}

export function getResidentialOverview(organizationId: string, token: string): Promise<{ overview: ResidentialOverview }> {
  return apiClient.get(`/organizations/${organizationId}/residential/overview`, token);
}

/* 171 (hogares F1): establecimientos, unidades, habitaciones, camas, ubicación de residentes, geocerca y cierre.
 * El backend nunca envía la unidad ni la habitación técnicas. */
export interface ResidentialOccupancy {
  rooms: number; bedsRegistered: number; bedsOccupied: number; bedsAvailable: number;
  activeResidents: number; residentsWithoutRoom: number; occupancyPercent: number | null;
  capacityConfigured: boolean; overCapacity: boolean;
}
export interface ResidentialEstablishmentSummary {
  id: string; name: string; address: string | null; status: "active" | "closed";
  geofence: { radiusMeters: number; centerConfigured: boolean };
  occupancy: ResidentialOccupancy;
}
export interface ResidentialPerson { id: string; displayName: string }
export interface ResidentialRoom {
  id: string; name: string; status: "active" | "archived"; bedCapacity: number | null;
  occupants: ResidentialPerson[]; overCapacity: boolean;
}
export interface ResidentialUnit { id: string; name: string; isGeneral: boolean; status: "active" | "archived"; rooms: ResidentialRoom[] }
export interface ResidentialGeofence { radiusMeters: number; latitude: number | null; longitude: number | null; updatedAt?: string }
export interface ResidentialEstablishmentDetail {
  establishment: { id: string; name: string; address: string | null; status: "active" | "closed" };
  geofence: ResidentialGeofence | null;
  occupancy: ResidentialOccupancy;
  units: ResidentialUnit[];
  residentsWithoutRoom: ResidentialPerson[];
}
export interface ResidentialPlacementEvent {
  occurredAt: string; reason: string | null; fromEstablishment: string | null; toEstablishment: string | null;
  fromRoom: string | null; toRoom: string | null; actorEmail: string | null;
}
export interface ResidentialGeofenceEvent { occurredAt: string; reason: string; oldRadiusMeters: number | null; newRadiusMeters: number; centerChanged: boolean; actorEmail: string | null }
export interface ResidentialClosureCheck { status: "active" | "closed"; futureShifts: number; activeAssignments: number; activeResidents: number; canClose: boolean }

const base = (organizationId: string) => `/organizations/${organizationId}/residential`;
export const residentialApi = {
  listEstablishments: (o: string, t: string) => apiClient.get<{ establishments: ResidentialEstablishmentSummary[] }>(`${base(o)}/establishments`, t),
  getEstablishment: (o: string, id: string, t: string) => apiClient.get<{ establishment: ResidentialEstablishmentDetail }>(`${base(o)}/establishments/${id}`, t),
  createUnit: (o: string, id: string, name: string, t: string) => apiClient.post<{ unit: ResidentialUnit }>(`${base(o)}/establishments/${id}/units`, { name }, t),
  updateUnit: (o: string, unitId: string, body: { name?: string; archived?: boolean }, t: string) => apiClient.patch<{ unit: ResidentialUnit }>(`${base(o)}/units/${unitId}`, body, t),
  createRoom: (o: string, id: string, body: { name: string; unitId?: string; bedCapacity?: number | null }, t: string) => apiClient.post<{ room: ResidentialRoom }>(`${base(o)}/establishments/${id}/rooms`, body, t),
  updateRoom: (o: string, roomId: string, body: { name?: string; unitId?: string; archived?: boolean; bedCapacity?: number | null }, t: string) => apiClient.patch<{ room: ResidentialRoom }>(`${base(o)}/rooms/${roomId}`, body, t),
  placeResident: (o: string, residentId: string, body: { roomId: string | null; establishmentId?: string; reason?: string }, t: string) =>
    apiClient.put<{ placement: { residentId: string; establishmentId: string; roomId: string | null; overCapacity: boolean } }>(`${base(o)}/residents/${residentId}/placement`, body, t),
  residentHistory: (o: string, residentId: string, t: string) => apiClient.get<{ history: ResidentialPlacementEvent[] }>(`${base(o)}/residents/${residentId}/placement-history`, t),
  updateGeofence: (o: string, id: string, body: { radiusMeters: number; latitude?: number | null; longitude?: number | null; reason: string }, t: string) =>
    apiClient.put<{ geofence: ResidentialGeofence }>(`${base(o)}/establishments/${id}/geofence`, body, t),
  geofenceHistory: (o: string, id: string, t: string) => apiClient.get<{ history: ResidentialGeofenceEvent[] }>(`${base(o)}/establishments/${id}/geofence-history`, t),
  closureCheck: (o: string, id: string, t: string) => apiClient.get<{ closure: ResidentialClosureCheck }>(`${base(o)}/establishments/${id}/closure-check`, t),
  close: (o: string, id: string, reason: string, t: string) => apiClient.post<{ closure: { closed: boolean; roomsArchived: number; unitsArchived: number; staffLinksArchived: number } }>(`${base(o)}/establishments/${id}/close`, { reason }, t),
};

/** Códigos de las reglas de la base de datos (171) con mensaje propio; los textos están en el catálogo «residential» (es/en). */
export const RESIDENTIAL_ERROR_CODES = [
  "RESIDENTIAL_NAME_TAKEN",
  "RESIDENTIAL_UNIT_HAS_ACTIVE_ROOMS",
  "RESIDENTIAL_ROOM_HAS_RESIDENTS",
  "RESIDENTIAL_ROOM_LOCATION_IMMUTABLE",
  "RESIDENTIAL_UNIT_ARCHIVED",
  "RESIDENTIAL_ROOM_ARCHIVED",
  "RESIDENTIAL_ROOM_LOCATION_MISMATCH",
  "RESIDENTIAL_ESTABLISHMENT_CLOSED",
  "RESIDENTIAL_ESTABLISHMENT_REQUIRED",
  "RESIDENTIAL_CLOSURE_REQUIRED",
  "RESIDENTIAL_TRANSFER_ACTIVE_SHIFTS",
  "RESIDENTIAL_CLOSURE_FUTURE_SHIFTS",
  "RESIDENTIAL_CLOSURE_ACTIVE_ASSIGNMENTS",
  "RESIDENTIAL_CLOSURE_ACTIVE_RESIDENTS",
  "RESIDENTIAL_REASON_REQUIRED",
  "RESIDENTIAL_MANAGER_REQUIRED",
  "INVALID_INPUT",
] as const;
export type ResidentialErrorCode = (typeof RESIDENTIAL_ERROR_CODES)[number];
export function residentialErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  return code && (RESIDENTIAL_ERROR_CODES as readonly string[]).includes(code)
    ? i18n.t(`residential:establishments.errors.${code as ResidentialErrorCode}`)
    : i18n.t("residential:establishments.errors.fallback");
}

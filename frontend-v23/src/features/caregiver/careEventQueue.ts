import { createContext, useContext } from "react";
import type { ApiError } from "@/api/client";
import type { CareEventTypeCode, CreateCareEventInput } from "@/api/careEvents";

/**
 * Cola de registros sin señal: cuidados, llegada y salida.
 *
 * Phase 12.4 (aprobado por Rafa 2026-10-22): para una sesión de cuidador/a
 * que se queda conectada, la cola se guarda CIFRADA en el teléfono
 * (offline/secureStore) y se borra sola al enviarse, a los 7 días o al cerrar
 * sesión. Para cualquier otra sesión sigue solo en memoria (como en 12.0).
 *
 * Cada registro lleva un clientEventId generado aquí y la hora real
 * (occurredAt). El backend devuelve el registro ya guardado si llega dos
 * veces, así que reintentar nunca duplica. Se envían en orden, uno a la vez:
 * llegada, cuidados y salida conservan su secuencia.
 */
export type QueueStatus = "pending" | "sending" | "failed";
export type QueuedKind = "care_event" | "check_in" | "check_out";

export interface VisitEventInput {
  clientEventId?: string;
  occurredAt?: string;
  /** Se guardó en el teléfono por falta de señal (el servidor lo marca). */
  recordedOffline?: boolean;
}

export interface QueuedCareEvent {
  clientEventId: string;
  kind: QueuedKind;
  organizationId: string;
  shiftId: string;
  typeCode?: CareEventTypeCode;
  label: string;
  input: CreateCareEventInput | VisitEventInput;
  status: QueueStatus;
  failure?: string;
  /** Cuándo se creó en el teléfono (para borrarlo a los 7 días). */
  createdAt: string;
}

export type SubmitResult = "sent" | "queued";

export interface CareEventQueueState {
  items: QueuedCareEvent[];
  /** Sube cada vez que un registro pendiente llega al servidor. */
  deliveredVersion: number;
  /** La cola se guarda cifrada en el teléfono (sesión de cuidador/a). */
  persisted: boolean;
  submit: (args: { organizationId: string; shiftId: string; label: string; input: Omit<CreateCareEventInput, "clientEventId" | "occurredAt"> }) => Promise<SubmitResult>;
  checkIn: (organizationId: string, shiftId: string) => Promise<SubmitResult>;
  checkOut: (organizationId: string, shiftId: string) => Promise<SubmitResult>;
  retryNow: () => void;
  discard: (clientEventId: string) => void;
}

export const CareEventQueueContext = createContext<CareEventQueueState>({
  items: [],
  deliveredVersion: 0,
  persisted: false,
  submit: async () => "sent",
  checkIn: async () => "sent",
  checkOut: async () => "sent",
  retryNow: () => {},
  discard: () => {},
});

export function useCareEventQueue(): CareEventQueueState {
  return useContext(CareEventQueueContext);
}

/** Sin conexión: el request nunca llegó o no volvió. Se reintenta. */
export function isConnectivityError(error: unknown): boolean {
  const apiError = error as ApiError;
  return apiError?.status === 0 || apiError?.isNetworkError === true;
}

/** Mensaje para un registro que el servidor rechazó al reintentar. */
export function failureMessage(error: unknown): string {
  const apiError = error as ApiError;
  if (apiError?.code === "ALREADY_CHECKED_IN") return "El turno ya tenía una llegada registrada.";
  if (apiError?.code === "NO_ACTIVE_CHECK_IN") return "No había una llegada activa para esta salida.";
  if (apiError?.code === "ASSIGNMENT_NOT_ACCEPTED") return "El turno no estaba aceptado.";
  if (apiError?.code === "SHIFT_CANCELLED") return "El turno fue cancelado.";
  if (apiError?.code === "NO_ACTIVE_VISIT" || apiError?.status === 404) return "El turno ya terminó y no se pudo enviar.";
  if (apiError?.code === "OCCURRED_AT_OUT_OF_RANGE") return "La hora del registro quedó fuera del turno.";
  if (apiError?.code === "CLIENT_EVENT_ID_CONFLICT") return "El registro no coincide con uno ya guardado.";
  return "No se pudo enviar.";
}

/** Estado de la visita según lo que aún espera en la cola del teléfono. */
export function queuedVisitState(items: QueuedCareEvent[], shiftId: string): "checked_in" | "checked_out" | null {
  let state: "checked_in" | "checked_out" | null = null;
  for (const item of items) {
    if (item.shiftId !== shiftId || item.status === "failed") continue;
    if (item.kind === "check_in") state = "checked_in";
    if (item.kind === "check_out") state = "checked_out";
  }
  return state;
}

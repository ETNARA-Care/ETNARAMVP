import { createContext, useContext } from "react";
import type { ApiError } from "@/api/client";
import type { CareEventTypeCode, CreateCareEventInput } from "@/api/careEvents";

/**
 * Cola de registros de cuidado sin señal.
 *
 * Vive SOLO en memoria (decisión aprobada por Rafa, 2026-10-21): no se guarda
 * información de pacientes en el teléfono. Si la app se cierra con registros
 * pendientes, se pierden; por eso se avisa antes de salir y no se permite
 * finalizar el turno con pendientes.
 *
 * Cada registro lleva un clientEventId generado aquí y la hora real
 * (occurredAt). El backend (Phase 12.0) devuelve el registro ya guardado si
 * llega dos veces, así que reintentar nunca duplica.
 */
export type QueueStatus = "pending" | "sending" | "failed";

export interface QueuedCareEvent {
  clientEventId: string;
  organizationId: string;
  shiftId: string;
  typeCode: CareEventTypeCode;
  label: string;
  input: CreateCareEventInput;
  status: QueueStatus;
  failure?: string;
}

export type SubmitResult = "sent" | "queued";

export interface CareEventQueueState {
  items: QueuedCareEvent[];
  /** Sube cada vez que un registro pendiente llega al servidor. */
  deliveredVersion: number;
  submit: (args: { organizationId: string; shiftId: string; label: string; input: Omit<CreateCareEventInput, "clientEventId" | "occurredAt"> }) => Promise<SubmitResult>;
  retryNow: () => void;
  discard: (clientEventId: string) => void;
}

export const CareEventQueueContext = createContext<CareEventQueueState>({
  items: [],
  deliveredVersion: 0,
  submit: async () => "sent",
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
  if (apiError?.code === "NO_ACTIVE_VISIT" || apiError?.status === 404) return "El turno ya terminó y no se pudo enviar.";
  if (apiError?.code === "OCCURRED_AT_OUT_OF_RANGE") return "La hora del registro quedó fuera del turno.";
  if (apiError?.code === "CLIENT_EVENT_ID_CONFLICT") return "El registro no coincide con uno ya guardado.";
  return "No se pudo enviar.";
}

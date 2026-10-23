import { useSyncExternalStore } from "react";
import { offlineReadyShifts, subscribeOfflineReady } from "@/offline/shiftCache";

/** El turno ya está guardado en el teléfono para abrirse sin señal. */
export function useOfflineReady(shiftId: string | undefined): boolean {
  const ready = useSyncExternalStore(subscribeOfflineReady, offlineReadyShifts, offlineReadyShifts);
  return !!shiftId && ready.has(shiftId);
}

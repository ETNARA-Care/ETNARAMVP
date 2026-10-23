import { listShiftCareEvents } from "@/api/careEvents";
import { getActiveCarePlan } from "@/api/carePlans";
import { getShiftServiceLocation } from "@/api/serviceLocations";
import { getVisitVerification, type Shift } from "@/api/shifts";

const WINDOW_MS = 36 * 3600 * 1000;

/**
 * Phase 12.4 · con señal, carga en segundo plano el detalle de los turnos
 * cercanos (llegada, cuidados, plan, dirección). El cliente lo recuerda en
 * memoria, así que el turno se abre aunque la señal se caiga en la puerta.
 * Nada se guarda en disco.
 */
export function prefetchUpcomingShifts(organizationId: string, shifts: Shift[], token: string): void {
  if (navigator.onLine === false) return;
  const now = Date.now();
  const soon = shifts.filter((shift) => {
    const start = new Date(shift.scheduled_start).getTime();
    const end = new Date(shift.scheduled_end).getTime();
    return shift.status !== "cancelled" && shift.status !== "completed" && end > now && start < now + WINDOW_MS;
  });
  for (const shift of soon) {
    void Promise.allSettled([
      getVisitVerification(organizationId, shift.id, token),
      listShiftCareEvents(organizationId, shift.id, token),
      ...(shift.care_recipient_id ? [
        getActiveCarePlan(organizationId, shift.care_recipient_id, token),
        // Gate 6: the confirmed address of THIS shift (kept in memory only).
        getShiftServiceLocation(organizationId, shift.id, token),
      ] : []),
    ]);
  }
}

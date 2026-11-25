import type { ShiftArrival } from "@/api/shifts";

/** «Llegué» results in plain Spanish (Gate 6). */
export const PROXIMITY_TEXT: Record<ShiftArrival["proximity"], string> = {
  NEAR: "Cerca del lugar del servicio",
  FAR: "Lejos del lugar: la agencia lo revisará",
  NO_CONSENT: "Sin verificación de ubicación: la agencia lo revisará",
  UNAVAILABLE: "Ubicación no disponible: la agencia lo revisará",
  NO_REFERENCE: "Registrada (el lugar aún no tiene punto GPS confirmado)",
};

/** Fase 1: en una práctica independiente nadie más revisa la llegada; el dato queda registrado tal cual. */
export const PRACTICE_PROXIMITY_TEXT: Record<ShiftArrival["proximity"], string> = {
  ...PROXIMITY_TEXT,
  FAR: "Lejos del lugar del servicio (queda registrado)",
  NO_CONSENT: "Sin verificación de ubicación (queda registrado)",
  UNAVAILABLE: "Ubicación no disponible (queda registrado)",
};

export function proximityText(proximity: ShiftArrival["proximity"], independent: boolean): string {
  return (independent ? PRACTICE_PROXIMITY_TEXT : PROXIMITY_TEXT)[proximity];
}

const LATE_AFTER_MIN = 15;

/** Minutes late = first of arrival / check-in versus the scheduled start (null when on time or not yet). */
export function minutesLate(scheduledStart: string, firstAt: string | null, now: number): number | null {
  const start = new Date(scheduledStart).getTime();
  const reference = firstAt ? new Date(firstAt).getTime() : now;
  const late = Math.floor((reference - start) / 60_000);
  return late >= LATE_AFTER_MIN ? late : null;
}


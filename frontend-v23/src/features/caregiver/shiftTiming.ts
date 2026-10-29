/**
 * Hora de un turno para la cuidadora (auditoría B5, 28-oct-2026).
 *
 * - Vencido sin iniciar: el horario ya terminó y nunca comenzó (estado sin asignar o
 *   asignado). No se cancela ni se cambia nada: se muestra aparte y sin botones de
 *   llegada o inicio; la agencia lo revisa. El backend rechaza «Comenzar» después del
 *   final (CHECK_IN_OUTSIDE_WINDOW) y «Llegué» / «En camino» fuera de su ventana.
 * - «Comenzar turno» se ofrece desde 2 h antes del inicio, como «Llegué».
 */
export const START_OPENS_BEFORE_MS = 2 * 60 * 60 * 1000;

type Timed = { status: string; scheduled_start: string; scheduled_end: string };

export function isOverdueUnstarted(shift: Timed, now = Date.now()): boolean {
  return (shift.status === "unassigned" || shift.status === "confirmed") && new Date(shift.scheduled_end).getTime() <= now;
}

export function startOpensAt(shift: Pick<Timed, "scheduled_start">): Date {
  return new Date(new Date(shift.scheduled_start).getTime() - START_OPENS_BEFORE_MS);
}

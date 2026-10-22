import type { ShiftStatus } from "@/api/shifts";

/**
 * Una sola regla de cobertura para todo el portal de agencia, igual a la del
 * Centro operacional (backend operations.service):
 *  - cubierto = la cuidadora ACEPTÓ (o ya registró llegada / terminó)
 *  - asignado pero sin respuesta = esperando respuesta (no está cubierto)
 *  - aceptado, pasaron 15 min del inicio y no hay llegada = sin llegada
 */
export type CoverageState = "cancelled" | "completed" | "in_progress" | "late" | "covered" | "awaiting" | "open";

export interface CoverageInput {
  status: ShiftStatus;
  scheduled_start: string;
  scheduled_end: string;
  assignmentResponse?: "pending" | "accepted" | null;
}

export const LATE_AFTER_MS = 15 * 60_000;

export function coverageOf(shift: CoverageInput, now: number = Date.now()): CoverageState {
  if (shift.status === "cancelled") return "cancelled";
  if (shift.status === "completed") return "completed";
  if (shift.status === "in_progress") return "in_progress";
  if (shift.assignmentResponse === "accepted") {
    const start = new Date(shift.scheduled_start).getTime();
    const end = new Date(shift.scheduled_end).getTime();
    return now > start + LATE_AFTER_MS && now < end ? "late" : "covered";
  }
  if (shift.assignmentResponse === "pending") return "awaiting";
  return "open";
}

/** Cuenta como cubierto solo lo confirmado: aceptado, en curso o terminado. */
export function isConfirmed(state: CoverageState): boolean {
  return state === "covered" || state === "late" || state === "in_progress" || state === "completed";
}

export interface CoverageSummary {
  total: number;
  confirmed: number;
  awaiting: number;
  open: number;
  late: number;
}

export function summarizeCoverage(shifts: CoverageInput[], now: number = Date.now()): CoverageSummary {
  const states = shifts.map((shift) => coverageOf(shift, now)).filter((state) => state !== "cancelled");
  return {
    total: states.length,
    confirmed: states.filter(isConfirmed).length,
    awaiting: states.filter((state) => state === "awaiting").length,
    open: states.filter((state) => state === "open").length,
    late: states.filter((state) => state === "late").length,
  };
}

/** "1 esperando respuesta · 1 sin cuidadora · 1 sin llegada", o null si todo está bien. */
export function coverageProblems(summary: CoverageSummary): string | null {
  const parts = [
    summary.open ? `${summary.open} sin cuidadora` : "",
    summary.awaiting ? `${summary.awaiting} esperando respuesta` : "",
    summary.late ? `${summary.late} sin llegada` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export const coverageLabel: Record<CoverageState, string> = {
  cancelled: "Cancelado",
  completed: "Completado",
  in_progress: "En curso",
  late: "Sin llegada",
  covered: "Confirmado",
  awaiting: "Esperando respuesta",
  open: "Sin cuidadora",
};

export const coverageTone: Record<CoverageState, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  cancelled: "neutral",
  completed: "neutral",
  in_progress: "accent",
  late: "danger",
  covered: "success",
  awaiting: "warning",
  open: "danger",
};

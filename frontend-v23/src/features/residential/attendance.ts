/**
 * 173–175 (hogares F4): reglas puras del portal de ponches (sin React ni red). El servidor decide la validación; aquí
 * solo se elige qué botones mostrar, se arma la cola sin conexión (SIN ubicación) y el CSV que aclara que no es nómina.
 */
import type { MyShift, PunchType, WeekRow } from "@/api/residentialAttendance";

/** Botones posibles según la sesión del turno (el servidor igual registra cualquier intento y marca el orden imposible). */
export function availablePunchTypes(shift: Pick<MyShift, "openSession" | "breakOpen" | "mealOpen">): PunchType[] {
  if (!shift.openSession) return ["in"];
  if (shift.breakOpen) return ["break_end"];
  if (shift.mealOpen) return ["meal_end"];
  return ["out", "break_start", "meal_start"];
}

/** Contenido del QR leído desde el enlace (`?c=`): se valida la forma; el servidor decide si es vigente. */
export function qrFromLink(search: string): string | null {
  const c = new URLSearchParams(search).get("c");
  return c && /^EA1\.[A-Za-z0-9_-]{1,32}\.[0-9a-f-]{36}\.\d{4}-\d{2}-\d{2}\.\d{1,6}\.[A-Za-z0-9_-]{22}$/.test(c) ? c : null;
}
/** Enlace impreso en el QR: abre «Ponchar» en el portal con el código; sin sesión iniciada no sirve. */
export function punchLink(origin: string, qr: string): string {
  return `${origin.replace(/\/+$/, "")}/caregiver/ponchar?c=${encodeURIComponent(qr)}`;
}

/** Ponche guardado en el teléfono sin conexión: nunca con ubicación (privacidad); se reenvía con su mismo id. */
export interface QueuedPunch { clientEventId: string; organizationId: string; shiftId: string; type: PunchType; method: "qr" | "pin"; qr?: string; pin?: string; declaredAt: string }
export const QUEUE_KEY = "etnara.attendanceQueue.v1";
export function parseQueue(raw: string | null): QueuedPunch[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.clientEventId === "string" && typeof x.shiftId === "string" && !("location" in x)).slice(0, 50) : [];
  } catch { return []; }
}
/**
 * 27-nov: ¿se quita de la cola un ponche que el servidor no aceptó? Solo con un rechazo definitivo (4xx salvo 408 y 429):
 * reintentarlo daría el mismo resultado. Se conserva con un fallo de red, un bloqueo temporal (429), un tiempo agotado
 * (408) o un error del servidor (5xx), para no perder nunca un ponche hecho sin conexión. La cola no se reintenta en
 * bucle: solo al volver la señal o al abrir la pantalla.
 */
export function dropQueuedAfterError(error: unknown): boolean {
  const e = error as { status?: number; isNetworkError?: boolean } | null;
  if (!e || e.isNetworkError || typeof e.status !== "number" || e.status === 0) return false;
  return e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
}

export function enqueue(queue: QueuedPunch[], item: QueuedPunch): QueuedPunch[] {
  return queue.some((q) => q.clientEventId === item.clientEventId) ? queue : [...queue, item].slice(-50);
}

export const minutesToHours = (m: number) => (m / 60).toFixed(2);
/** CSV de asistencia: registro administrativo, no nómina (aviso en la primera fila). Cabecera traducida. */
export function attendanceCsvRows(notice: string, header: readonly string[], rows: readonly WeekRow[], yes: string, no: string): string[][] {
  return [[notice], [...header], ...rows.map((r) => [r.scheduledStart, r.workerName ?? "", r.firstInAt ?? "", r.lastOutAt ?? "", String(r.lateMinutes),
    String(r.earlyLeaveMinutes), r.absent ? yes : no, minutesToHours(r.validatedMinutes), minutesToHours(r.pendingMinutes)])];
}

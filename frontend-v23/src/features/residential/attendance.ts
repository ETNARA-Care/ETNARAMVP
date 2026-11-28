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

/**
 * Contenido del QR leído desde el enlace. 27-nov (auditoría GPT, C): va en el FRAGMENTO (`#c=`), que el navegador nunca
 * envía a ningún servidor, así que no queda en registros de acceso del portal; además «Ponchar» lo quita de la barra de
 * direcciones al leerlo. Se valida la forma; el servidor decide si es vigente.
 */
export function qrFromLink(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  const c = new URLSearchParams(hash.slice(1)).get("c");
  return c && /^EA1\.[A-Za-z0-9_-]{1,32}\.[0-9a-f-]{36}\.\d{4}-\d{2}-\d{2}\.\d{1,6}\.[A-Za-z0-9_-]{22}$/.test(c) ? c : null;
}
/** Enlace impreso en el QR: abre «Ponchar» en el portal con el código en el fragmento; sin sesión iniciada no sirve. */
export function punchLink(origin: string, qr: string): string {
  return `${origin.replace(/\/+$/, "")}/caregiver/ponchar#c=${encodeURIComponent(qr)}`;
}

// La cola sin conexión vive en ./attendanceQueue (persona + organización, candado entre pestañas, sin pérdidas).

export const minutesToHours = (m: number) => (m / 60).toFixed(2);
/** CSV de asistencia: registro administrativo, no nómina (aviso en la primera fila). Cabecera traducida. */
export function attendanceCsvRows(notice: string, header: readonly string[], rows: readonly WeekRow[], yes: string, no: string): string[][] {
  return [[notice], [...header], ...rows.map((r) => [r.scheduledStart, r.workerName ?? "", r.firstInAt ?? "", r.lastOutAt ?? "", String(r.lateMinutes),
    String(r.earlyLeaveMinutes), r.absent ? yes : no, minutesToHours(r.validatedMinutes), minutesToHours(r.pendingMinutes)])];
}

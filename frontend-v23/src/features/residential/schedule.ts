/**
 * 172 (hogares F2): cálculos puros del calendario semanal en el portal (sin React ni red, para probarlos solos).
 * Puerto Rico no tiene horario de verano: la fecha local es siempre UTC−4. Las fechas se manejan como texto
 * «YYYY-MM-DD» / «YYYY-MM-DDTHH:MM» locales, igual que el backend.
 */
import type { ScheduleEntry, ScheduleSlot, ScheduleStaff } from "@/api/residentialSchedule";

const PR_OFFSET_MS = -4 * 3_600_000;

/** Fecha local de Puerto Rico («YYYY-MM-DD») de un instante. */
export function puertoRicoDate(now: Date = new Date()): string {
  return new Date(now.getTime() + PR_OFFSET_MS).toISOString().slice(0, 10);
}
/** Desplaza una fecha local n días. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** Día ISO (1 = lunes … 7 = domingo) de una fecha local. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
/** Lunes de la semana de una fecha local. */
export function mondayOf(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}
/** Los siete días (lunes a domingo) de la semana que empieza en `weekStart`. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
export const isMonday = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && addDays(date, 0) === date && isoWeekday(date) === 1;

/** Entradas visibles agrupadas por el día local en que EMPIEZAN (las quitadas ya publicadas se muestran aparte). */
export function entriesByDay(weekStart: string, entries: readonly ScheduleEntry[]): Map<string, ScheduleEntry[]> {
  const out = new Map(weekDays(weekStart).map((d) => [d, [] as ScheduleEntry[]]));
  for (const e of entries) if (!e.removed) out.get(e.startsAt.slice(0, 10))?.push(e);
  for (const list of out.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  return out;
}

/** Minutos → «7.5 h» (hasta dos decimales, con el separador del idioma activo). */
export function formatHours(minutes: number, language: string | undefined): string {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return `${hours.toLocaleString(language === "en" ? "en-US" : "es-PR", { maximumFractionDigits: 2 })} h`;
}
export const timeOf = (local: string) => local.slice(11, 16);

/** Entradas de una persona implicadas en un aviso (para marcarlas en la cuadrícula). */
export function warnedEntryIds(warnings: ReadonlyArray<{ entryIds: string[] }>): Set<string> {
  return new Set(warnings.flatMap((w) => w.entryIds));
}

/**
 * Solo una indicación: el backend aplica las reglas de cumplimiento al publicar. Se marca a quien el backend ya calculó
 * como no apto (no apto, pendiente, suspendido, vencido o con acción requerida); «unknown» (aún sin calcular) no se marca.
 */
export function staffNeedsReview(staff: ScheduleStaff): boolean {
  return ["not_eligible", "pending", "suspended", "expired", "action_required"].includes(staff.eligibility);
}

/** Plantilla a partir de la semana: una plaza por cada hora/duración/rol/etiqueta y día, con su número de plazas. */
export function slotsFromWeek(entries: readonly ScheduleEntry[]): ScheduleSlot[] {
  const map = new Map<string, ScheduleSlot>();
  for (const e of entries) {
    if (e.removed) continue;
    const slot = { weekday: isoWeekday(e.startsAt.slice(0, 10)), startTime: timeOf(e.startsAt), durationMinutes: e.durationMinutes, requiredRole: e.requiredRole, label: e.label ?? null };
    const key = `${slot.weekday}|${slot.startTime}|${slot.durationMinutes}|${slot.requiredRole}|${slot.label ?? ""}`;
    const prev = map.get(key);
    if (prev) prev.headcount = Math.min(20, prev.headcount + 1); else map.set(key, { ...slot, headcount: 1 });
  }
  return [...map.values()].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
}

/** Filas del CSV del horario (sin cálculos de pago: solo horas programadas). La cabecera llega traducida. */
export function scheduleCsvRows(header: readonly string[], entries: readonly ScheduleEntry[], labels: { unassigned: string; published: string; draft: string }): string[][] {
  const rows = entries.filter((e) => !e.removed).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .map((e) => [e.startsAt.slice(0, 10), timeOf(e.startsAt), e.endsAt.replace("T", " "), (e.durationMinutes / 60).toFixed(2), e.requiredRole,
      e.workerName ?? labels.unassigned, e.label ?? "", e.published ? labels.published : labels.draft]);
  return [[...header], ...rows];
}

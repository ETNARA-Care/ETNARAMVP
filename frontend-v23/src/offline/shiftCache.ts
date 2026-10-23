import { exportRemembered, importRemembered, onRemembered } from "@/api/client";
import type { Shift } from "@/api/shifts";
import { getToken, isKeptSession } from "@/auth/token";
import { MAX_AGE_MS, secureDelete, secureGet, secureSet } from "./secureStore";

/**
 * Turnos próximos guardados CIFRADOS en el teléfono (Phase 12.5, aprobado por
 * Rafa 2026-10-23) para que la app abra sin señal desde cero.
 *
 * Mínimo necesario: solo los turnos propios de la cuidadora que no han
 * terminado y empiezan en las próximas 36 horas, con su residente (nombre,
 * dirección, plan de cuidado) y lo registrado en esa visita. Un turno que
 * termina sale del caché en el siguiente guardado o al abrir la app. Solo
 * para sesiones de cuidador/a que se quedan en el teléfono; se borra al
 * cerrar sesión (secureClearAll) y vence a los 7 días como máximo.
 */
const SECURE_READS = "reads";
const AHEAD_MS = 36 * 3600 * 1000;
const SAVE_DELAY_MS = 1500;

interface StoredReads {
  token: string;
  entries: Array<[string, unknown]>;
}

const SHIFTS = /^\/organizations\/[^/]+\/me\/shifts$/;
const PROFILE = /^\/organizations\/[^/]+\/me\/worker-profile$/;
const RECIPIENTS = /^\/organizations\/[^/]+\/care-recipients$/;
const SHIFT_PART = /^\/organizations\/[^/]+\/shifts\/([^/]+)\/(visit-verification|care-events)$/;
const RECIPIENT_PART = /^\/organizations\/[^/]+\/care-recipients\/([^/]+)\/(care-plan|location)$/;

/** Turnos que valen la pena tener sin señal: propios, no terminados y cercanos. */
export function isUpcoming(shift: Shift, now = Date.now()): boolean {
  if (shift.status === "cancelled" || shift.status === "completed") return false;
  if (shift.status === "in_progress") return true;
  return new Date(shift.scheduled_end).getTime() > now && new Date(shift.scheduled_start).getTime() < now + AHEAD_MS;
}

/** Deja solo lo que corresponde a los turnos cercanos; devuelve también cuándo vence. */
export function minimizeReads(entries: Array<[string, unknown]>, now = Date.now()): { entries: Array<[string, unknown]>; expiresAt: number } {
  const shiftIds = new Set<string>();
  const recipientIds = new Set<string>();
  let lastEnd = now;
  const kept: Array<[string, unknown]> = [];
  for (const [path, value] of entries) {
    if (!SHIFTS.test(path)) continue;
    const shifts = ((value as { shifts?: Shift[] })?.shifts ?? []).filter((shift) => isUpcoming(shift, now));
    for (const shift of shifts) {
      shiftIds.add(shift.id);
      if (shift.care_recipient_id) recipientIds.add(shift.care_recipient_id);
      lastEnd = Math.max(lastEnd, new Date(shift.scheduled_end).getTime());
    }
    if (shifts.length > 0) kept.push([path, { ...(value as object), shifts }]);
  }
  if (shiftIds.size === 0) return { entries: [], expiresAt: now };
  for (const [path, value] of entries) {
    if (PROFILE.test(path)) kept.push([path, value]);
    else if (RECIPIENTS.test(path)) {
      const recipients = ((value as { recipients?: Array<{ id: string }> })?.recipients ?? []).filter((r) => recipientIds.has(r.id));
      if (recipients.length > 0) kept.push([path, { ...(value as object), recipients }]);
    } else {
      const shiftPart = SHIFT_PART.exec(path);
      if (shiftPart && shiftIds.has(shiftPart[1])) { kept.push([path, value]); continue; }
      const recipientPart = RECIPIENT_PART.exec(path);
      if (recipientPart && recipientIds.has(recipientPart[1])) kept.push([path, value]);
    }
  }
  // Hasta 12 h después del último turno, nunca más de 7 días.
  return { entries: kept, expiresAt: Math.min(lastEnd + 12 * 3600 * 1000, now + MAX_AGE_MS) };
}

let timer: ReturnType<typeof setTimeout> | null = null;

async function save(): Promise<void> {
  const token = getToken();
  if (!token || !isKeptSession()) return;
  const { entries, expiresAt } = minimizeReads(exportRemembered(token));
  if (entries.length === 0) await secureDelete(SECURE_READS);
  else await secureSet(SECURE_READS, { token, entries } satisfies StoredReads, expiresAt);
}

/** Empieza a guardar (cifrado) lo que la cuidadora va viendo de sus turnos cercanos. */
export function startShiftCache(): void {
  onRemembered(() => {
    if (!isKeptSession()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void save(); }, SAVE_DELAY_MS);
  });
}

export function stopShiftCache(): void {
  onRemembered(null);
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Al abrir la app: repone en memoria los turnos guardados de esta misma sesión. */
export async function restoreShiftCache(): Promise<void> {
  const token = getToken();
  if (!token || !isKeptSession()) return;
  const stored = await secureGet<StoredReads>(SECURE_READS);
  if (!stored || stored.token !== token) return;
  const { entries } = minimizeReads(stored.entries);
  if (entries.length === 0) { await secureDelete(SECURE_READS); return; }
  importRemembered(token, entries);
}

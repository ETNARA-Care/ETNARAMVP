import { exportRemembered, importRemembered, onRemembered } from "@/api/client";
import type { Shift } from "@/api/shifts";
import { getToken, isKeptSession } from "@/auth/token";
import { MAX_AGE_MS, secureDelete, secureGet, secureSet } from "./secureStore";

/**
 * Turnos próximos guardados CIFRADOS en el teléfono (Phase 12.5, aprobado por
 * Rafa 2026-10-23) para que la app abra sin señal desde cero.
 *
 * Mínimo necesario: solo los turnos propios y ACEPTADOS de la cuidadora que no
 * han terminado y empiezan en las próximas 36 horas, con su residente (nombre,
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
// Gate 6: the shift's confirmed service address follows the same rule as the
// resident's address above (encrypted, upcoming own shifts only, 7 days max).
// Gate 7: the journey state too, so «Voy en camino» still shows without signal.
const SHIFT_PART = /^\/organizations\/[^/]+\/shifts\/([^/]+)\/(visit-verification|care-events|service-location|journey)$/;
// La ruta antigua de dirección por persona (/location) es solo de la administración
// desde Backend #234: la cuidadora usa la dirección del turno (SHIFT_PART).
const RECIPIENT_PART = /^\/organizations\/[^/]+\/care-recipients\/([^/]+)\/(care-plan)$/;

/**
 * Turnos que valen la pena tener sin señal: propios, ACEPTADOS, no terminados y
 * cercanos. Una asignación pendiente no guarda nada en el teléfono (la dirección
 * solo se entrega con el turno aceptado, Backend #234).
 */
export function isUpcoming(shift: Shift, now = Date.now()): boolean {
  if (shift.assignment_response_status !== "accepted") return false;
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
      // Al terminar el turno vence la copia. Solo una visita en curso conserva un
      // margen (12 h) para poder terminarla sin señal después de la hora de fin.
      const end = new Date(shift.scheduled_end).getTime();
      lastEnd = Math.max(lastEnd, shift.status === "in_progress" ? end + 12 * 3600 * 1000 : end);
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
  // Hasta el fin del último turno (visita en curso: +12 h), nunca más de 7 días.
  return { entries: kept, expiresAt: Math.min(lastEnd, now + MAX_AGE_MS) };
}

let timer: ReturnType<typeof setTimeout> | null = null;

// Turnos que ya están guardados en el teléfono con lo necesario para abrirse
// sin señal (la pantalla muestra "Listo para usar sin señal").
let ready: ReadonlySet<string> = new Set();
const readyListeners = new Set<() => void>();
function setReady(entries: Array<[string, unknown]>): void {
  const ids = new Set<string>();
  for (const [path] of entries) {
    const part = SHIFT_PART.exec(path);
    if (part && part[2] === "visit-verification") ids.add(part[1]);
  }
  ready = ids;
  for (const listener of readyListeners) listener();
}
export function subscribeOfflineReady(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => { readyListeners.delete(listener); };
}
export function offlineReadyShifts(): ReadonlySet<string> {
  return ready;
}

/** Guarda ya (cifrado) lo recordado; devuelve false si esta sesión no guarda nada. */
export async function saveShiftCacheNow(): Promise<boolean> {
  const token = getToken();
  if (!token || !isKeptSession()) return false;
  const { entries, expiresAt } = minimizeReads(exportRemembered(token));
  if (entries.length === 0) await secureDelete(SECURE_READS);
  else await secureSet(SECURE_READS, { token, entries } satisfies StoredReads, expiresAt);
  setReady(entries);
  return true;
}
const save = saveShiftCacheNow;

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
  setReady([]);
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
  setReady(entries);
}

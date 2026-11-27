/**
 * 173–175 (hogares F4) · Cola de ponches sin conexión — auditoría de GPT del 27-nov (hallazgos A1–A6).
 *
 * - A1. Cada ponche guardado lleva la persona Y la organización. Solo esa persona, en esa organización, lo ve, lo envía o
 *   lo descarta. Otra persona en el mismo teléfono nunca lo toca (sigue guardado para su dueña).
 * - A2. Toda modificación de la cola pasa por un candado (Web Locks: común a todas las pestañas; si el navegador no lo
 *   tiene, un candado de la pestaña) y relee el almacenamiento dentro de él. Nunca se escribe una copia antigua encima de
 *   la actual, y nunca se hace una petición de red con el candado tomado. Un solo envío a la vez por teléfono.
 * - A3. Guardar se comprueba releyendo: si el almacenamiento está lleno o no disponible, se dice (nunca un «guardado»
 *   falso).
 * - A4. No hay límite que borre: con MAX_PENDING ponches pendientes de la misma persona, el nuevo NO se guarda y se avisa.
 * - A5/A6. Nada se borra solo, salvo lo que el servidor aceptó. Cada error se clasifica por su causa: red, 5xx, 408 y 429
 *   esperan; 401 (sesión vencida) y 404 FEATURE_NOT_ENABLED (asistencia apagada por ahora) esperan con su explicación;
 *   el resto (403, 404, 400, 409…) queda «no aceptado», a la vista, con su explicación, y la persona puede reintentarlo,
 *   pedir una corrección o descartarlo ella misma.
 * Nunca se guarda la ubicación. La clave anterior (v1) no se lee: F4 no ha estado nunca en producción.
 */
import type { PunchType } from "@/api/residentialAttendance";

export const QUEUE_KEY_V2 = "etnara.attendanceQueue.v2";
export const MAX_PENDING = 50;

export type QueueHold = "auth" | "feature";
export interface QueueItem {
  clientEventId: string;
  userId: string;
  organizationId: string;
  shiftId: string;
  type: PunchType;
  method: "qr" | "pin";
  qr?: string;
  pin?: string;
  declaredAt: string;
  status: "pending" | "rejected";
  /** Último motivo por el que no se envió (solo informativo para la persona). */
  hold?: QueueHold;
  rejection?: { status: number; code: string | null; at: string };
}
export interface Owner { userId: string; organizationId: string }

const TYPES = new Set(["in", "out", "break_start", "break_end", "meal_start", "meal_end"]);
function isItem(x: unknown): x is QueueItem {
  const v = x as Partial<QueueItem> | null;
  return !!v && typeof v.clientEventId === "string" && typeof v.userId === "string" && typeof v.organizationId === "string"
    && typeof v.shiftId === "string" && typeof v.type === "string" && TYPES.has(v.type) && (v.method === "qr" || v.method === "pin")
    && typeof v.declaredAt === "string" && (v.status === "pending" || v.status === "rejected") && !("location" in (v as object));
}
/** Lectura tolerante: nunca recorta ni descarta ponches válidos; ignora lo que no tenga la forma esperada. */
export function parseItems(raw: string | null): QueueItem[] {
  try { const v = JSON.parse(raw ?? "[]"); return Array.isArray(v) ? v.filter(isItem) : []; } catch { return []; }
}
export const mine = (items: readonly QueueItem[], o: Owner) => items.filter((i) => i.userId === o.userId && i.organizationId === o.organizationId);

/** Almacenamiento mínimo (localStorage en el portal; un mapa en las pruebas). */
export interface QueueStorage { getItem(k: string): string | null; setItem(k: string, v: string): void }
export function readAll(storage: QueueStorage | null): QueueItem[] {
  try { return storage ? parseItems(storage.getItem(QUEUE_KEY_V2)) : []; } catch { return []; }
}
/** Escribe y RELEE para confirmar. false = no se guardó (lleno, bloqueado o no disponible). */
export function writeAll(storage: QueueStorage | null, items: readonly QueueItem[]): boolean {
  if (!storage) return false;
  const text = JSON.stringify(items);
  try { storage.setItem(QUEUE_KEY_V2, text); return storage.getItem(QUEUE_KEY_V2) === text; } catch { return false; }
}

export type AddResult = "saved" | "duplicate" | "full" | "storage_failed";
/** Añade un ponche pendiente sin tocar los demás (de nadie). */
export function addItem(storage: QueueStorage | null, item: QueueItem): AddResult {
  const all = readAll(storage);
  if (all.some((i) => i.clientEventId === item.clientEventId)) return "duplicate";
  if (mine(all, item).filter((i) => i.status === "pending").length >= MAX_PENDING) return "full";
  return writeAll(storage, [...all, item]) ? "saved" : "storage_failed";
}
/** Cambia UN ponche (relee antes). Devuelve false si no se pudo guardar el cambio. */
export function updateItem(storage: QueueStorage | null, clientEventId: string, change: (i: QueueItem) => QueueItem | null): boolean {
  const all = readAll(storage);
  const next: QueueItem[] = [];
  for (const i of all) {
    if (i.clientEventId !== clientEventId) { next.push(i); continue; }
    const c = change(i);
    if (c) next.push(c);
  }
  return writeAll(storage, next);
}

/** Qué hacer con un ponche que el servidor no aceptó, según la causa. */
export type ErrorDecision = { kind: "retry" } | { kind: "hold"; hold: QueueHold } | { kind: "rejected"; status: number; code: string | null };
export function classifyQueueError(error: unknown): ErrorDecision {
  const e = error as { status?: number; code?: string; isNetworkError?: boolean } | null;
  if (!e || e.isNetworkError || typeof e.status !== "number" || e.status === 0) return { kind: "retry" };
  if (e.status >= 500 || e.status === 408 || e.status === 429) return { kind: "retry" };
  if (e.status === 401) return { kind: "hold", hold: "auth" };
  if (e.status === 404 && e.code === "FEATURE_NOT_ENABLED") return { kind: "hold", hold: "feature" };
  return { kind: "rejected", status: e.status, code: e.code ?? null };
}

/** Candado común a las pestañas (Web Locks) o, sin él, de esta pestaña. Nunca envuelve una petición de red. */
let localChain: Promise<unknown> = Promise.resolve();
type LockManager = { request: (name: string, opts: { ifAvailable?: boolean }, cb: (lock: unknown) => Promise<unknown>) => Promise<unknown> };
const locks = (): LockManager | null => {
  const l = (globalThis.navigator as unknown as { locks?: LockManager } | undefined)?.locks;
  return l && typeof l.request === "function" ? l : null;
};
export function withQueueLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const l = locks();
  if (l) return l.request("etnara-attendance-queue", {}, async () => fn()) as Promise<T>;
  const run = localChain.then(() => fn());
  localChain = run.catch(() => undefined);
  return run;
}
/** Un solo envío de la cola a la vez en todo el teléfono; si ya hay uno en curso, este no hace nada. */
let localFlushing = false;
export async function withFlushLock(fn: () => Promise<void>): Promise<boolean> {
  const l = locks();
  if (l) {
    let ran = false;
    await l.request("etnara-attendance-flush", { ifAvailable: true }, async (lock) => { if (!lock) return; ran = true; await fn(); });
    return ran;
  }
  if (localFlushing) return false;
  localFlushing = true;
  try { await fn(); return true; } finally { localFlushing = false; }
}

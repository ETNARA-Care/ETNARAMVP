/**
 * C3 (auditoría 31-oct-2026): registros sin enviar, cifrados y ligados a la cuenta que los creó.
 *
 * - Cada cuenta tiene su bóveda: `pending:<userId>`, cifrada con la llave de esa cuenta
 *   (`user:<userId>`, no exportable). Ninguna otra cuenta del mismo teléfono la abre: la app solo la
 *   lee para la cuenta que el servidor (o la sesión guardada de esa misma cuenta) confirma.
 * - Terminar la sesión (401, vencida, revocada, cerrar sesión «guardando») NO borra la bóveda.
 * - Vaciar o descartar borra los registros Y la llave de la cuenta (quedan ilegibles).
 * - Un índice cifrado con la llave del teléfono solo guarda cuántos registros hay por cuenta, para
 *   avisar en la entrada sin mostrar de quién son ni qué contienen.
 * - Los registros vencen a los 7 días como hasta ahora (regla aprobada en 12.4).
 *
 * Sin dependencias de React ni alias de rutas: se prueba tal cual en Node (tests/c3-*.test.mjs).
 */
import { MAX_AGE_MS, secureDelete, secureForgetKey, secureGet, secureSet } from "./secureStore.ts";

export interface VaultItem {
  clientEventId: string;
  createdAt: string;
  status: string;
}

interface StoredVault<T extends VaultItem> {
  userId: string;
  items: T[];
}

/** Cuántos registros guardados hay por cuenta (sin contenido). */
type PendingIndex = Record<string, { count: number; oldest: string }>;

const INDEX = "pending-index";
const LEGACY_QUEUE = "queue";
const vaultName = (userId: string) => `pending:${userId}`;
const keyIdOf = (userId: string) => `user:${userId}`;

async function readIndex(): Promise<PendingIndex> {
  return (await secureGet<PendingIndex>(INDEX)) ?? {};
}

async function writeIndex(index: PendingIndex): Promise<void> {
  if (Object.keys(index).length === 0) await secureDelete(INDEX);
  else await secureSet(INDEX, index);
}

function fresh<T extends VaultItem>(items: T[]): T[] {
  const cutoff = Date.now() - MAX_AGE_MS;
  return items.filter((item) => new Date(item.createdAt).getTime() > cutoff);
}

/** Registros guardados de ESA cuenta (los «enviando» vuelven a «pendiente»). Nunca los de otra. */
export async function loadPending<T extends VaultItem>(userId: string): Promise<T[]> {
  const stored = await secureGet<StoredVault<T>>(vaultName(userId), { keyId: keyIdOf(userId) });
  if (!stored || stored.userId !== userId) return [];
  return fresh(stored.items).map((item) => (item.status === "sending" ? ({ ...item, status: "pending" } as T) : item));
}

/** Guarda la lista completa de la cuenta. Vacía: borra la bóveda y la llave de la cuenta. */
export async function savePending<T extends VaultItem>(userId: string, items: T[]): Promise<void> {
  const kept = fresh(items);
  const index = await readIndex();
  if (kept.length === 0) {
    await secureDelete(vaultName(userId));
    await secureForgetKey(keyIdOf(userId));
    delete index[userId];
  } else {
    await secureSet(vaultName(userId), { userId, items: kept } satisfies StoredVault<T>, Date.now() + MAX_AGE_MS, { keyId: keyIdOf(userId) });
    index[userId] = { count: kept.length, oldest: kept.map((i) => i.createdAt).sort()[0] };
  }
  await writeIndex(index);
}

/** Descartar a propósito (la propia cuenta lo confirma): borra registros y llave. */
export async function discardPending(userId: string): Promise<void> {
  await savePending(userId, []);
}

/** Para la pantalla de entrada: total guardado en el teléfono y de cuántas cuentas, sin contenido. */
export async function pendingOnDevice(): Promise<{ total: number; accounts: number }> {
  const cutoff = Date.now() - MAX_AGE_MS;
  const index = await readIndex();
  const live = Object.values(index).filter((entry) => new Date(entry.oldest).getTime() > cutoff || entry.count > 0);
  return { total: live.reduce((sum, entry) => sum + entry.count, 0), accounts: live.length };
}

/** Una sola vez: la cola anterior (un solo nombre, llave del teléfono) pasa a la bóveda de su dueña. */
export async function migrateLegacyQueue<T extends VaultItem>(): Promise<void> {
  const legacy = await secureGet<StoredVault<T>>(LEGACY_QUEUE);
  if (!legacy) return;
  if (legacy.userId && Array.isArray(legacy.items) && legacy.items.length > 0) {
    const current = await loadPending<T>(legacy.userId);
    const merged = [...current, ...legacy.items.filter((i) => !current.some((c) => c.clientEventId === i.clientEventId))];
    await savePending(legacy.userId, merged);
  }
  await secureDelete(LEGACY_QUEUE);
}

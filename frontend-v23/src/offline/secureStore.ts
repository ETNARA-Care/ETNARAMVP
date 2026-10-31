/**
 * Almacén cifrado en el teléfono (Phase 12.4, aprobado por Rafa 2026-10-22).
 *
 * Solo guarda lo que el modo sin señal necesita: la sesión de un cuidador y
 * los registros que aún no llegaron al servidor. Todo va cifrado con
 * AES-GCM; la llave es una CryptoKey NO exportable creada por el navegador y
 * guardada en IndexedDB, así que el contenido no se puede leer copiando los
 * archivos del navegador. Cada valor lleva su fecha de vencimiento (máx. 7
 * días) y se borra solo; al cerrar sesión se borra todo.
 *
 * Si el navegador no tiene IndexedDB o WebCrypto (modo privado antiguo), todo
 * falla en silencio y la app sigue como antes: solo en memoria.
 *
 * C3 (auditoría 31-oct-2026): además de la llave del teléfono, cada cuenta
 * tiene su propia llave (`keyId`), también NO exportable. Los registros sin
 * enviar de una cuenta se cifran con la suya; terminar la sesión (401, vencida,
 * revocada) borra solo la sesión, nunca esos registros. Descartarlos borra los
 * registros y su llave (quedan ilegibles).
 */
const DB_NAME = "etnara-secure";
const STORE = "items";
const KEY_ID = "__key";
export const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

interface Sealed {
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
  expiresAt: number;
}

function available(): boolean {
  return typeof indexedDB !== "undefined" && typeof crypto !== "undefined" && !!crypto.subtle;
}

/** El teléfono puede guardar cifrado (IndexedDB + WebCrypto). */
export function secureStoreAvailable(): boolean {
  return available();
}

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { dbPromise = null; reject(request.error); };
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

const DEVICE_KEY = KEY_ID;
const keyPromises = new Map<string, Promise<CryptoKey>>();
/** Llave del teléfono (por defecto) o de una cuenta (`user:<id>`). Se crea la primera vez. */
function getKey(keyId: string = DEVICE_KEY): Promise<CryptoKey> {
  const storeId = keyId === DEVICE_KEY ? DEVICE_KEY : `${KEY_ID}:${keyId}`;
  let promise = keyPromises.get(storeId);
  if (!promise) {
    promise = run<CryptoKey | undefined>("readonly", (s) => s.get(storeId)).then(async (existing) => {
      if (existing) return existing;
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await run("readwrite", (s) => s.put(key, storeId));
      return key;
    }).catch((error) => { keyPromises.delete(storeId); throw error; });
    keyPromises.set(storeId, promise);
  }
  return promise;
}

export interface SecureOptions {
  /** Cifra con la llave de una cuenta (`user:<id>`) en lugar de la del teléfono. */
  keyId?: string;
}

/** Guarda un valor cifrado. Vence a los 7 días como máximo. */
export async function secureSet(name: string, value: unknown, expiresAt = Date.now() + MAX_AGE_MS, options: SecureOptions = {}): Promise<void> {
  if (!available()) return;
  try {
    const key = await getKey(options.keyId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value)));
    const sealed: Sealed = { iv, data, expiresAt: Math.min(expiresAt, Date.now() + MAX_AGE_MS) };
    await run("readwrite", (s) => s.put(sealed, name));
  } catch {
    // Sin almacenamiento disponible: se queda solo en memoria.
  }
}

/** Lee y descifra un valor; si venció o no se puede leer, lo borra y devuelve null. */
export async function secureGet<T>(name: string, options: SecureOptions = {}): Promise<T | null> {
  if (!available()) return null;
  try {
    const sealed = await run<Sealed | undefined>("readonly", (s) => s.get(name));
    if (!sealed) return null;
    if (sealed.expiresAt <= Date.now()) {
      await secureDelete(name);
      return null;
    }
    const key = await getKey(options.keyId);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: sealed.iv }, key, sealed.data);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    // Con la llave de una cuenta (C3), un fallo NO borra: otra llave nunca destruye registros ajenos.
    if (!options.keyId) await secureDelete(name);
    return null;
  }
}

export async function secureDelete(name: string): Promise<void> {
  if (!available()) return;
  try { await run("readwrite", (s) => s.delete(name)); } catch { /* nada que borrar */ }
}

/** Borra la llave de una cuenta: lo cifrado con ella queda ilegible para siempre. */
export async function secureForgetKey(keyId: string): Promise<void> {
  const storeId = `${KEY_ID}:${keyId}`;
  keyPromises.delete(storeId);
  if (!available()) return;
  try { await run("readwrite", (s) => s.delete(storeId)); } catch { /* nada que borrar */ }
}

/** Borra TODO lo del teléfono, incluidas todas las llaves. Ya no se usa al terminar una sesión (C3). */
export async function secureClearAll(): Promise<void> {
  keyPromises.clear();
  if (!available()) return;
  try {
    await run("readwrite", (s) => s.clear());
  } catch { /* nada que borrar */ }
}

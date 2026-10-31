import { secureDelete, secureGet, secureSet } from "@/offline/secureStore";
import { forgetRememberedResponses } from "@/api/client";

/**
 * Única fuente del token de sesión para toda la app. Ningún otro módulo debe
 * leer/escribir sessionStorage directamente.
 *
 * - Por defecto la sesión vive mientras dure la pestaña (sessionStorage).
 * - Phase 12.4 (aprobado por Rafa): una cuenta SOLO de cuidador/a puede
 *   quedarse conectada hasta 7 días para trabajar sin señal. El backend
 *   decide (keepSignedIn) y fija el vencimiento; aquí la copia se guarda
 *   cifrada (offline/secureStore) y se borra al cerrar sesión.
 *
 * Nunca se imprime a consola ni se expone en UI.
 */
const TOKEN_KEY = "etnara.session.token";
const KEPT_KEY = "etnara.session.kept";
const SECURE_SESSION = "session";

interface KeptSession {
  token: string;
  expiresAt: string;
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, options?: { keepSignedIn?: boolean; expiresAt?: string }): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  if (options?.keepSignedIn && options.expiresAt) {
    sessionStorage.setItem(KEPT_KEY, "1");
    void secureSet(SECURE_SESSION, { token, expiresAt: options.expiresAt } satisfies KeptSession, new Date(options.expiresAt).getTime());
  } else {
    sessionStorage.removeItem(KEPT_KEY);
  }
}

/** La sesión actual es de cuidador/a y se conserva en el teléfono. */
export function isKeptSession(): boolean {
  return sessionStorage.getItem(KEPT_KEY) === "1";
}

/** Al abrir la app: recupera la sesión guardada de un cuidador/a, si no venció. */
export async function restoreToken(): Promise<void> {
  if (getToken()) return;
  const kept = await secureGet<KeptSession>(SECURE_SESSION);
  if (!kept || new Date(kept.expiresAt).getTime() <= Date.now()) return;
  sessionStorage.setItem(TOKEN_KEY, kept.token);
  sessionStorage.setItem(KEPT_KEY, "1");
}

/**
 * Lo que pertenece a la SESIÓN en el teléfono: la sesión guardada, la copia de /me y los turnos
 * cercanos y el bloqueo con Face ID. Se borra al terminar la sesión (cerrar sesión, 401, vencida o revocada).
 */
export const SESSION_SECURE_ITEMS = [SECURE_SESSION, "identity", "reads", "lock"] as const;

/**
 * Cierra la sesión local y borra lo de la sesión guardado en el teléfono.
 * C3 (auditoría 31-oct-2026): NO borra los registros sin enviar. Siguen cifrados con la llave
 * de su cuenta (offline/pendingVault) y solo esa cuenta puede enviarlos o descartarlos.
 */
export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(KEPT_KEY);
  forgetRememberedResponses();
  for (const name of SESSION_SECURE_ITEMS) void secureDelete(name);
}

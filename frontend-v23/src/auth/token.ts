import { secureClearAll, secureGet, secureSet } from "@/offline/secureStore";
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

/** Cierra la sesión local y borra todo lo guardado en el teléfono. */
export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(KEPT_KEY);
  forgetRememberedResponses();
  void secureClearAll();
}

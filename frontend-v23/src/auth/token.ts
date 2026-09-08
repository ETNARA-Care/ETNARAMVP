/**
 * Única fuente del token de sesión para toda la app -- una sola clave en
 * sessionStorage (decisión explícita de Fase 3: sesión vive mientras dure
 * la pestaña, no localStorage). Nunca se imprime a consola ni se expone
 * en UI; ningún otro módulo debe leer/escribir sessionStorage directamente.
 */
const TOKEN_KEY = "etnara.session.token";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

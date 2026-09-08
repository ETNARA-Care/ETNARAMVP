/**
 * Cliente HTTP mínimo para el backend real de ETNARA
 * (https://etnara-care-backend-staging-production-b0b7.up.railway.app).
 *
 * Reglas de esta capa, deliberadas:
 * - Nunca convierte un fallo de red/CORS en un 401 -- eso sería mostrarle
 *   a alguien "contraseña incorrecta" cuando el problema es de conexión.
 *   `fetch()` solo lanza (catch) por red/CORS; un status HTTP nunca llega
 *   a ese catch, así que la distinción es estructural, no adivinada.
 * - El backend responde errores como `{ error: "CODE" }` (confirmado
 *   inspeccionando auth.routes.ts / middleware/auth.ts en el zip real),
 *   nunca un campo `message` legible -- por eso ApiError.message queda
 *   sin poblar aquí; los mensajes en español se arman en la capa de UI
 *   (ver src/auth/errorMessages.ts) a partir de `status`/`code`, no
 *   inventados en el cliente.
 */

export interface ApiError {
  status: number; // 0 cuando es error de red/CORS, nunca un status HTTP inventado
  code?: string; // el `error` code del backend, ej. "INVALID_CREDENTIALS"
  message?: string;
  isNetworkError?: boolean;
}

function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) {
    const err: ApiError = { status: 0, message: "VITE_API_URL no está configurada." };
    throw err;
  }
  return raw.replace(/\/+$/, "");
}

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase()}${normalized}`;
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Respuesta no-JSON (ej. HTML de un proxy/CDN caído) -- no asumimos shape.
    return null;
  }
}

interface RequestOptions {
  method: "GET" | "POST";
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    const networkError: ApiError = { status: 0, isNetworkError: true };
    throw networkError;
  }

  const body = await parseJsonSafely(response);

  if (!response.ok) {
    const code = body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
      ? (body as { error: string }).error
      : undefined;
    const apiError: ApiError = { status: response.status, code };
    throw apiError;
  }

  return body as T;
}

export const apiClient = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { method: "GET", token }),
  post: <T>(path: string, body?: unknown, token?: string | null) => request<T>(path, { method: "POST", body, token }),
};

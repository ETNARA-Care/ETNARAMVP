// Cliente API mínimo para ETNARA Care. Habla con el backend real (nunca
// datos simulados). El token se guarda en sessionStorage (no localStorage
// persistente indefinido, y nunca en cookies no-httpOnly de terceros) y
// jamás se imprime a consola.
//
// Base URL: en desarrollo local usa el proxy relativo de Vite (/api ->
// localhost:3000, ver vite.config.ts). En un build de producción/preview
// estático (GitHub Pages, Vercel, etc.) NO existe ese proxy -- la URL del
// backend debe inyectarse vía la variable de entorno VITE_API_URL en
// tiempo de build. Si no se provee, el cliente cae de vuelta a la ruta
// relativa /api, que simplemente no resolverá a ningún backend real en un
// hosting estático sin backend público -- deliberado: nunca se hardcodea
// localhost como si fuera un valor de producción válido.
const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "etnara.session.token";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const url = new URL(API_BASE + path, window.location.origin);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url.toString().replace(window.location.origin, ""), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const code = (json as { error?: string } | null)?.error ?? `HTTP_${res.status}`;
    // 401: session expired/invalid -- caller (AuthContext) handles clearing
    // the session and redirecting to login. Never logged with token value.
    throw new ApiError(res.status, code);
  }

  return json as T;
}

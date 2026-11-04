/**
 * Web Push en el navegador — reglas puras (sin React ni red), probadas con node --test.
 *
 * iPhone/iPad: solo iOS 16.4+ y SOLO con ETNARA abierta desde la pantalla de inicio
 * (en Safari normal no existe PushManager). Android: Chrome/Edge/Firefox/Samsung Internet.
 */
export type PushAvailability =
  | "unsupported"       // este navegador no tiene push
  | "ios-needs-install" // iPhone en Safari: hay que añadir ETNARA a la pantalla de inicio
  | "denied"            // la persona bloqueó los avisos: solo se cambia en Ajustes del teléfono
  | "available"         // se puede activar (falta tocar el botón)
  | "enabled";          // este teléfono ya recibe avisos

export interface BrowserFacts {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: "default" | "granted" | "denied" | null;
  subscribed: boolean;
}

export function isAppleMobile(f: Pick<BrowserFacts, "userAgent" | "maxTouchPoints">): boolean {
  // iPadOS se presenta como Mac: se distingue por la pantalla táctil.
  return /iPhone|iPad|iPod/.test(f.userAgent) || (/Macintosh/.test(f.userAgent) && f.maxTouchPoints > 1);
}

export function pushAvailability(f: BrowserFacts): PushAvailability {
  const apple = isAppleMobile(f);
  if (apple && !f.standalone) return "ios-needs-install";
  if (!f.hasServiceWorker || !f.hasPushManager || !f.hasNotification) return apple ? "ios-needs-install" : "unsupported";
  if (f.permission === "denied") return "denied";
  if (f.permission === "granted" && f.subscribed) return "enabled";
  return "available";
}

/** Clave pública VAPID (base64url) → bytes para pushManager.subscribe. */
export function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Nombre del dispositivo para «Mis teléfonos». Nunca el nombre de la persona. */
export function deviceLabel(userAgent: string, maxTouchPoints = 0): string {
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return "iPad";
  if (/iPhone|iPod/.test(userAgent)) return "iPhone";
  if (/Android/.test(userAgent)) return /Mobile/.test(userAgent) ? "Teléfono Android" : "Tableta Android";
  if (/Windows/.test(userAgent)) return "Computadora Windows";
  if (/Macintosh/.test(userAgent)) return "Mac";
  return "Navegador";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Solo un id de aviso válido sobrevive a /abrir?n=… (lo demás se ignora). */
export function parseOpenParam(search: string): string | null {
  const n = new URLSearchParams(search).get("n");
  return n && UUID.test(n) ? n.toLowerCase() : null;
}

/** Solo rutas internas de un portal (nunca otro dominio, ni //, ni Central). */
export function isSafeInternalPath(path: unknown): path is string {
  return typeof path === "string" && /^\/(agency|caregiver|family)(\/[A-Za-z0-9/_-]*)?(\?[A-Za-z0-9=&_-]*)?$/.test(path) && !path.includes("//");
}

/** HH:MM válido; el silencio nocturno no puede empezar y terminar a la misma hora. */
export function validQuietRange(start: string, end: string): boolean {
  const ok = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  return ok(start) && ok(end) && start !== end;
}

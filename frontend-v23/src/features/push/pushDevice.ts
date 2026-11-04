import { pushApi, type BrowserSubscription } from "@/api/push";
import { deviceLabel, pushAvailability, urlBase64ToUint8Array, type BrowserFacts, type PushAvailability } from "./pushSupport";

/**
 * Web Push en ESTE teléfono: activar, desactivar y mantener la suscripción al día.
 * - El permiso se pide SOLO después de que la persona toca «Activar notificaciones».
 * - Un teléfono pertenece a quien lo activó: si inicia sesión otra persona en el mismo
 *   navegador, la suscripción anterior se cancela (no pasa en silencio a la nueva persona).
 * - Al cerrar sesión se cancela aquí y en el servidor.
 */
const OWNER_KEY = "etnara.push.owner";
function owner(): string | null { try { return localStorage.getItem(OWNER_KEY); } catch { return null; } }
function setOwner(userId: string | null): void {
  try { if (userId) localStorage.setItem(OWNER_KEY, userId); else localStorage.removeItem(OWNER_KEY); } catch { /* modo privado */ }
}

function hasPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!hasPush()) return null;
  // Solo en producción hay service worker (main.tsx). Sin él no se puede suscribir.
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? null;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function readBrowserFacts(): Promise<BrowserFacts> {
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const sub = await currentSubscription().catch(() => null);
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: !!standalone,
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: typeof window !== "undefined" && "PushManager" in window,
    hasNotification: typeof window !== "undefined" && "Notification" in window,
    permission: typeof Notification !== "undefined" ? Notification.permission : null,
    subscribed: !!sub,
  };
}

export async function currentAvailability(): Promise<PushAvailability> {
  return pushAvailability(await readBrowserFacts());
}

function asBrowserSubscription(sub: PushSubscription): BrowserSubscription {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  return { endpoint: json.endpoint ?? sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } };
}

export type EnableResult = "enabled" | "denied" | "unavailable" | "error";

/**
 * Llamar DIRECTAMENTE desde el toque del botón: iOS exige que el permiso se pida en
 * respuesta a un gesto, así que no hay ninguna espera de red antes de requestPermission.
 */
export async function enablePushOnThisDevice(publicKey: string, token: string, userId: string): Promise<EnableResult> {
  if (!hasPush()) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "error";
  const reg = await registration();
  if (!reg) return "unavailable";
  try {
    let sub = await reg.pushManager.getSubscription();
    if (sub && owner() && owner() !== userId) { await sub.unsubscribe().catch(() => undefined); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource });
    await pushApi.register(asBrowserSubscription(sub), deviceLabel(navigator.userAgent, navigator.maxTouchPoints ?? 0), token);
    setOwner(userId);
    return "enabled";
  } catch {
    return "error";
  }
}

export async function disablePushOnThisDevice(token: string | null): Promise<void> {
  const sub = await currentSubscription().catch(() => null);
  if (sub) {
    if (token) await pushApi.unregister(sub.endpoint, token).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  setOwner(null);
}

/**
 * Al iniciar sesión o abrir la app: si este teléfono ya estaba activado POR ESTA persona,
 * se renueva (enlaza la sesión nueva y evita la limpieza de 30 días). Si lo activó otra
 * persona, se cancela. Nunca pide permisos ni muestra nada.
 */
export async function syncPushOnSession(token: string, userId: string): Promise<void> {
  if (!hasPush() || Notification.permission !== "granted") return;
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  if (owner() !== userId) { await sub.unsubscribe().catch(() => undefined); setOwner(null); return; }
  await pushApi.register(asBrowserSubscription(sub), deviceLabel(navigator.userAgent, navigator.maxTouchPoints ?? 0), token).catch(() => undefined);
}

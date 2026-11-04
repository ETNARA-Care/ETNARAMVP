/*
 * ETNARA Care · copia de la app en el teléfono (Phase 12.5).
 *
 * Solo guarda el PROGRAMA (index.html, JS, CSS, íconos, fuentes) para que la
 * app abra sin señal. NUNCA guarda respuestas del servidor: las llamadas a la
 * API (otro dominio) no pasan por aquí, y los datos de turnos van cifrados en
 * offline/secureStore, no en este caché.
 *
 * - Páginas: primero la red; sin señal, la última copia de index.html.
 * - Archivos /assets/* (con hash en el nombre): del caché, y si no, de la red.
 * - Al publicar una versión nueva cambia BUILD y se borra la copia anterior.
 *
 * Push (Backend 146): muestra el aviso con el texto fijo que manda el servidor y, al
 * tocarlo, abre /abrir?n=<id> en ESTE origen (nunca otro dominio). El servidor decide el
 * destino con sesión. Formato declarativo de WebKit: en iOS 18.4+ Safari puede mostrarlo
 * por sí solo; aquí se muestra igual para los demás navegadores.
 */
const BUILD = "__ETNARA_BUILD__";
const CACHE = `etnara-app-${BUILD}`;
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

async function precache() {
  const cache = await caches.open(CACHE);
  const response = await fetch("/index.html", { cache: "no-store" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put("/index.html", response);
  // Los archivos que index.html necesita para arrancar.
  const urls = new Set(["/favicon.svg", "/etnara-mark.svg", "/manifest.webmanifest", "/icons/icon-192.png"]);
  for (const match of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
    if (match[1].startsWith("/assets/")) urls.add(match[1]);
  }
  await Promise.all([...urls].map(async (url) => {
    try {
      const asset = await fetch(url);
      if (asset.ok) await cache.put(url, asset);
    } catch { /* se intentará al usarse */ }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("etnara-app-") && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return; // API y todo lo demás: sin tocar.

  if (sameOrigin && request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) (await caches.open(CACHE)).put("/index.html", fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("/index.html")) || Response.error();
      }
    })());
    return;
  }

  if (isFont || url.pathname.startsWith("/assets/") || /\.(svg|png|webmanifest)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh.ok || fresh.type === "opaque") (await caches.open(CACHE)).put(request, fresh.clone());
        return fresh;
      } catch {
        return Response.error();
      }
    })());
  }
});

// ---------------------------------------------------------------- notificaciones push
const DEFAULT_TITLE = "ETNARA Care";
const DEFAULT_BODY = "Tienes un aviso nuevo en ETNARA";

/** Solo /abrir?n=<uuid> de este mismo origen; cualquier otra cosa abre la app. */
function safeOpenUrl(raw) {
  try {
    const url = new URL(String(raw || ""), self.location.origin);
    const n = url.searchParams.get("n") || "";
    if (url.origin === self.location.origin && url.pathname === "/abrir"
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(n)) {
      return `${self.location.origin}/abrir?n=${n.toLowerCase()}`;
    }
  } catch { /* */ }
  return `${self.location.origin}/`;
}

function readPush(event) {
  let data = null;
  try { data = event.data ? event.data.json() : null; } catch { data = null; }
  const n = data && typeof data === "object" ? data.notification : null;
  const text = (v, fallback, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback);
  return {
    title: text(n && n.title, DEFAULT_TITLE, 40),
    body: text(n && n.body, DEFAULT_BODY, 120),
    url: safeOpenUrl(n && n.navigate),
  };
}

self.addEventListener("push", (event) => {
  const p = readPush(event);
  // Siempre se muestra un aviso visible (iOS revoca la suscripción si no).
  event.waitUntil(self.registration.showNotification(p.title, {
    body: p.body,
    icon: "/icons/icon-192.png",
    lang: "es-PR",
    data: { url: p.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeOpenUrl(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && "focus" in client) {
        await client.focus();
        if ("navigate" in client) { try { await client.navigate(url); return; } catch { /* abre una nueva */ } }
      }
    }
    await self.clients.openWindow(url);
  })());
});

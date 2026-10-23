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
  const urls = new Set(["/favicon.svg", "/etnara-mark.svg", "/manifest.webmanifest"]);
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

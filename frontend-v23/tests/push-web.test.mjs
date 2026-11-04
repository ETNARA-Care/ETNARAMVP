// Notificaciones push (Backend 146, 4-nov-2026): PWA, permisos, destino seguro y textos.
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { deviceLabel, isSafeInternalPath, parseOpenParam, pushAvailability, urlBase64ToUint8Array, validQuietRange } from "../src/features/push/pushSupport.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const png = (path) => { const b = readFileSync(new URL(`../${path}`, import.meta.url)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), sig: b.subarray(1, 4).toString() }; };
const UUID = "0f1e2d3c-4b5a-4968-8776-655443322110";
const facts = (over = {}) => ({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Chrome", maxTouchPoints: 5, standalone: false,
  hasServiceWorker: true, hasPushManager: true, hasNotification: true, permission: "default", subscribed: false, ...over });
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.4 Safari/605.1.15";

test("manifest: PNG 192/512, maskable, id, standalone; iPhone con apple-touch-icon PNG 180", () => {
  const m = JSON.parse(read("public/manifest.webmanifest"));
  assert.equal(m.display, "standalone"); assert.equal(m.id, "/"); assert.equal(m.start_url, "/"); assert.equal(m.scope, "/");
  const icons = m.icons.map((i) => `${i.src}|${i.sizes}|${i.purpose}`);
  for (const want of ["/icons/icon-192.png|192x192|any", "/icons/icon-512.png|512x512|any", "/icons/icon-maskable-192.png|192x192|maskable", "/icons/icon-maskable-512.png|512x512|maskable"]) assert.ok(icons.includes(want), want);
  for (const i of m.icons.filter((x) => x.type === "image/png")) {
    const p = png(`public${i.src}`); assert.equal(p.sig, "PNG"); assert.equal(`${p.w}x${p.h}`, i.sizes);
  }
  const html = read("index.html");
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\/icons\/apple-touch-icon\.png" \/>/);
  assert.doesNotMatch(html, /apple-touch-icon" href="\/etnara-mark\.svg"/);
  assert.equal(`${png("public/icons/apple-touch-icon.png").w}`, "180");
  assert.ok(statSync(new URL("../public/etnara-mark.svg", import.meta.url)).size > 0, "el logotipo oficial sigue en su lugar");
});

test("disponibilidad: iPhone en Safari pide añadir a inicio; instalada se puede activar; bloqueada; activada", () => {
  assert.equal(pushAvailability(facts({ userAgent: IPHONE, hasPushManager: false })), "ios-needs-install");
  assert.equal(pushAvailability(facts({ userAgent: IPHONE, standalone: false })), "ios-needs-install");
  assert.equal(pushAvailability(facts({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5, standalone: false })), "ios-needs-install");
  assert.equal(pushAvailability(facts({ userAgent: IPHONE, standalone: true })), "available");
  assert.equal(pushAvailability(facts()), "available");
  assert.equal(pushAvailability(facts({ permission: "denied" })), "denied");
  assert.equal(pushAvailability(facts({ permission: "granted", subscribed: true })), "enabled");
  assert.equal(pushAvailability(facts({ permission: "granted", subscribed: false })), "available");
  assert.equal(pushAvailability(facts({ hasPushManager: false })), "unsupported");
});

test("/abrir solo acepta un id de aviso y solo navega a rutas internas de un portal", () => {
  assert.equal(parseOpenParam(`?n=${UUID}`), UUID);
  for (const bad of ["?n=1", "?n=../../platform", "?x=" + UUID, "?n=" + UUID + "x", ""]) assert.equal(parseOpenParam(bad), null, bad);
  for (const ok of ["/agency/shifts/" + UUID, "/caregiver/shifts", "/family", "/family/messages?thread=" + UUID]) assert.ok(isSafeInternalPath(ok), ok);
  for (const bad of ["https://evil.example/", "//evil.example", "/platform/organizations", "/agency//x", "javascript:alert(1)", null, 42]) assert.ok(!isSafeInternalPath(bad), String(bad));
});

test("utilidades: clave VAPID, nombre del dispositivo sin datos personales, silencio nocturno", () => {
  assert.deepEqual([...urlBase64ToUint8Array("AQID-_8")], [1, 2, 3, 251, 255]);
  assert.equal(deviceLabel(IPHONE), "iPhone");
  assert.equal(deviceLabel(IPAD_AS_MAC, 5), "iPad");
  assert.equal(deviceLabel("Mozilla/5.0 (Linux; Android 14) Mobile"), "Teléfono Android");
  assert.ok(validQuietRange("22:00", "07:00")); assert.ok(!validQuietRange("22:00", "22:00")); assert.ok(!validQuietRange("25:00", "07:00"));
});

test("el permiso se pide solo al tocar el botón (sin esperas de red antes en iOS) y nunca al cargar", () => {
  const device = read("src/features/push/pushDevice.ts");
  const enable = device.slice(device.indexOf("export async function enablePushOnThisDevice"), device.indexOf("export async function disablePushOnThisDevice"));
  const beforePermission = enable.slice(0, enable.indexOf("const permission = await Notification.requestPermission()"));
  assert.ok(beforePermission.length > 0);
  assert.doesNotMatch(beforePermission, /await /, "ninguna espera antes de requestPermission");
  assert.match(enable, /userVisibleOnly: true/);
  const card = read("src/features/push/NotificationSettingsCard.tsx");
  assert.doesNotMatch(card.slice(0, card.indexOf("async function enable")), /requestPermission/);
  const sync = device.slice(device.indexOf("export async function syncPushOnSession"));
  assert.doesNotMatch(sync, /requestPermission|\.subscribe\(/, "la renovación silenciosa nunca pide permiso ni crea suscripciones");
  assert.match(sync, /owner\(\) !== userId/, "un teléfono activado por otra persona no pasa en silencio a la nueva sesión");
});

test("cerrar sesión cancela la suscripción en el teléfono y en el servidor", () => {
  const auth = read("src/auth/AuthProvider.tsx");
  const logout = auth.slice(auth.indexOf("const logout = useCallback"), auth.indexOf("const endSession"));
  assert.match(logout, /await disablePushOnThisDevice\(token\)/);
  assert.ok(logout.indexOf("disablePushOnThisDevice") < logout.indexOf("authApi.logout"), "antes de cerrar la sesión en el servidor");
  assert.match(read("src/api/push.ts"), /\/me\/push\/subscriptions\/unsubscribe", \{ endpoint \}/, "el endpoint va en el cuerpo, nunca en la URL");
});

test("service worker: aviso siempre visible, texto acotado, solo abre /abrir?n=<uuid> del mismo origen", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /self\.addEventListener\("push"/);
  assert.match(sw, /self\.registration\.showNotification\(p\.title/);
  assert.match(sw, /self\.addEventListener\("notificationclick"/);
  assert.match(sw, /url\.origin === self\.location\.origin && url\.pathname === "\/abrir"/);
  assert.match(sw, /slice\(0, max\)/);
  assert.doesNotMatch(sw, /fetch\([^)]*push/i, "el service worker no pide datos del aviso a nadie");
});

test("/abrir: sin sesión guarda el id y pide iniciar sesión; con sesión el servidor decide el destino", () => {
  const page = read("src/pages/OpenNotificationPage.tsx");
  assert.match(page, /navigate\("\/login", \{ replace: true \}\)/);
  assert.match(page, /pushApi\.target\(id, token\)/);
  assert.match(page, /if \(!isSafeInternalPath\(target\.path\)\) \{ inbox\(\); return; \}/);
  assert.match(page, /setActiveOrganization\(target\.organizationId\)/);
  assert.match(read("src/pages/LoginPage.tsx"), /if \(readPendingOpen\(\)\) \{ navigate\("\/abrir", \{ replace: true \}\); return; \}/);
  assert.match(read("src/App.tsx"), /<Route path="\/abrir" element=\{<OpenNotificationPage\/>\}\/>/);
  assert.match(read("src/features/push/pendingOpen.ts"), /sessionStorage/);
});

test("la tarjeta aparece en los tres portales y se oculta si el servidor tiene push apagado", () => {
  for (const p of ["src/pages/caregiver/CaregiverSupportPages.tsx", "src/pages/family/FamilySupportPages.tsx", "src/pages/agency/AgencyOrganizationSettingsPage.tsx"]) assert.match(read(p), /<NotificationSettingsCard \/>/, p);
  assert.match(read("src/features/push/NotificationSettingsCard.tsx"), /if \(!config\.enabled\) return null;/);
});

test("textos es/en completos y sin promesas falsas de privacidad", () => {
  const es = JSON.parse(read("src/i18n/locales/es/common.json")).push, en = JSON.parse(read("src/i18n/locales/en/common.json")).push;
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  assert.match(es.description, /nunca nombres, direcciones ni datos de salud/);
  assert.match(es.iosVersion, /16\.4/);
});

test("ETNARA central: interruptor «Notificaciones en el teléfono» por agencia (solo enciende o apaga)", () => {
  const card = read("src/features/platform/OrganizationFeaturesCard.tsx");
  assert.match(card, /PUSH_NOTIFICATIONS: \{ title: "Notificaciones en el teléfono"/);
  assert.match(card, /"SHIFT_REPORTS", "PUSH_NOTIFICATIONS", "ACTIVITY_PHOTOS"\]/);
  assert.match(read("src/api/platformOrganizations.ts"), /\| "PUSH_NOTIFICATIONS" \| "ACTIVITY_PHOTOS";/);
});

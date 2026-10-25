// «Pegar ubicación» (Gate 6 improvement): paste an Apple Maps / Google Maps / Waze link,
// coordinates or a written address; preview the PIN, «Ajustar PIN», «Confirmar ubicación».
// Fictitious places only.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const links = await import(new URL("../src/features/serviceLocation/mapLinks.ts", import.meta.url));

// addressHint.ts uses the «@/» alias: load a copy that points at the real municipalities file.
const dir = mkdtempSync(join(tmpdir(), "addr-"));
const muni = new URL("../src/features/smartmatch/municipalities.ts", import.meta.url).href;
writeFileSync(join(dir, "addressHint.ts"), read("src/features/serviceLocation/addressHint.ts").replace("@/features/smartmatch/municipalities", muni));
const { addressFromText } = await import(pathToFileURL(join(dir, "addressHint.ts")).href);

const paste = read("src/features/serviceLocation/PasteLocation.tsx");
const pin = read("src/features/serviceLocation/PinPreview.tsx");
const picker = read("src/features/serviceLocation/LocationMapPicker.tsx");
const section = read("src/features/serviceLocation/ServiceLocationSection.tsx");
const gps = read("src/features/serviceLocation/GpsConfirmModal.tsx");
const family = read("src/features/family/FamilyServiceLocationCard.tsx");
const api = read("src/api/serviceLocations.ts");

const point = (raw) => { const r = links.parseMapInput(raw); assert.equal(r.kind, "point", `${raw} → ${r.kind}`); return r; };

test("parser: Apple Maps, Google Maps and Waze links with coordinates", () => {
  const a = point("https://maps.apple.com/?ll=18.234100,-66.048500&q=Casa%20de%20prueba");
  assert.deepEqual(a.point, { latitude: 18.2341, longitude: -66.0485 }); assert.equal(a.source, "apple");
  assert.equal(point("https://maps.apple.com/?address=Calle%20Ficticia%201,%20Caguas&coordinate=18.2341,-66.0485").source, "apple");
  const g = point("https://www.google.com/maps/place/Casa+Prueba/@18.3,-66.1,17z/data=!3d18.234100!4d-66.048500");
  assert.deepEqual(g.point, { latitude: 18.2341, longitude: -66.0485 }); // the place pin wins over the camera «@»
  assert.equal(point("https://www.google.com/maps/search/?api=1&query=18.2341,-66.0485").source, "google");
  assert.equal(point("https://maps.google.com/?q=18.2341,-66.0485").source, "google");
  assert.equal(point("https://waze.com/ul?ll=18.2341,-66.0485&navigate=yes").source, "waze");
  assert.equal(point("https://www.waze.com/live-map/directions?to=ll.18.2341%2C-66.0485").source, "waze");
  const h = point("https://waze.com/ul/hde1p9p2vq"); assert.equal(h.source, "waze");
  assert.ok(links.inPuertoRico(h.point));
});

test("parser: coordinates as text (decimal and degrees) and links inside shared text", () => {
  assert.equal(point("18.234100, -66.048500").source, "coordinates");
  assert.equal(point("18.2341 -66.0485").source, "coordinates");
  const d = point(`18°14'02.8"N 66°02'54.6"W`);
  assert.ok(Math.abs(d.point.latitude - 18.2341) < 0.0002 && Math.abs(d.point.longitude + 66.0485) < 0.0002);
  const shared = point("Casa de prueba\nCalle Ficticia 1, Caguas\nhttps://maps.apple.com/?ll=18.2341,-66.0485");
  assert.match(shared.placeHint ?? "", /Calle Ficticia 1/);
  // Apple share sheet: place name, address line, link with only «q=<name>» → the address line is the hint.
  assert.equal(point("Casa de prueba\nCalle Ficticia 12, Caguas, PR 00725\nhttps://maps.apple.com/?ll=18.2341,-66.0485&q=Casa").placeHint, "Calle Ficticia 12, Caguas, PR 00725");
  const short = links.parseMapInput("Casa\nCalle Luna 12, Caguas 00725\nhttps://maps.app.goo.gl/AbC123xyz");
  assert.equal(short.kind, "short-link"); assert.equal(short.placeHint, "Calle Luna 12, Caguas 00725");
  assert.equal(short.url, "https://maps.app.goo.gl/AbC123xyz"); // only the link goes to the server
});

test("parser: short links go to the server; nothing else does", () => {
  assert.equal(links.parseMapInput("https://maps.app.goo.gl/AbCdEf123").kind, "short-link");
  assert.equal(links.parseMapInput("https://goo.gl/maps/AbCdEf123").kind, "short-link");
  assert.equal(links.parseMapInput("https://maps.apple/p/AbCdEf.123").kind, "short-link");
  // A short link with a port, credentials or another host is not «short» and is rejected.
  assert.equal(links.parseMapInput("https://maps.app.goo.gl:8443/AbCdEf").kind, "unsupported-link");
  assert.equal(links.parseMapInput("https://user:pw@maps.app.goo.gl/AbCdEf").kind, "unsupported-link");
});

test("parser: invalid, incomplete and dangerous input never yields an invented point", () => {
  assert.equal(links.parseMapInput("").kind, "empty");
  assert.equal(links.parseMapInput("https://maps.apple.com/?q=Casa").kind, "no-point");
  assert.equal(links.parseMapInput("https://www.google.com/maps/place/Plaza+Ficticia").kind, "no-point");
  assert.equal(links.parseMapInput("https://maps.apple.com/?ll=40.7128,-74.0060").kind, "outside-pr");
  assert.equal(links.parseMapInput("40.7128, -74.0060").kind, "outside-pr");
  for (const bad of ["https://evil.example/maps?ll=18.2,-66.0", "https://maps.apple.com.evil.example/?ll=18.2,-66.0",
    "https://bit.ly/abc123", "javascript:alert(1)", "data:text/html,hi", "ftp://maps.apple.com/?ll=18.2,-66.0",
    "https://www.google.com/search?q=18.2,-66.0"]) {
    assert.equal(links.parseMapInput(bad).kind, "unsupported-link", bad);
  }
  assert.equal(links.parseMapInput("Calle Ficticia 1, Apt:5, Caguas").kind, "text"); // «Apt:5» is not a scheme
  assert.equal(links.parseMapInput("Calle Ficticia 1").kind, "text");
});

test("address hint: splits a written Puerto Rico address locally, without coordinates", () => {
  assert.deepEqual(addressFromText("Calle Ficticia 12, Urb. Las Pruebas, Caguas, PR 00725"),
    { addressLine: "Calle Ficticia 12, Urb. Las Pruebas", municipality: "Caguas", postalCode: "00725" });
  assert.equal(addressFromText("Carr. 2 km 5, San German PR 00683").municipality, "San Germán");
  assert.equal(addressFromText("Calle Ficticia 3, Juana Díaz 00795").municipality, "Juana Díaz");
  const incomplete = addressFromText("Calle Ficticia 9");
  assert.deepEqual(incomplete, { addressLine: "Calle Ficticia 9", municipality: "", postalCode: "" });
  assert.doesNotMatch(read("src/features/serviceLocation/addressHint.ts"), /fetch\(|latitude|longitude/);
});

test("the shared parser is the backend's verbatim copy and runs on the phone only", () => {
  const src = code(read("src/features/serviceLocation/mapLinks.ts"));
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|import /);
  assert.doesNotMatch(code(paste), /nominatim|geocod|googleapis|mapbox/i);
  // Only short links leave the phone, and only to ETNARA's own endpoint.
  assert.match(paste, /case "short-link":[\s\S]*resolveMapLink\(r\.url, token\)/);
  assert.match(api, /"\/maps\/resolve-link"/);
});

test("«Pegar ubicación» UI: visible paste field, button, clear messages; nothing auto-confirmed", () => {
  assert.match(paste, /id="paste-location-input"/);
  assert.match(paste, />Pegar ubicación</);
  assert.match(paste, /navigator\.clipboard\?\.readText/);
  assert.match(paste, /onPaste=\{onPaste\}/);
  assert.match(paste, /className="[^"]*text-base/); // 16px: Safari on iPhone does not zoom into the field
  assert.match(paste, /role="status" aria-live="polite"/);
  for (const m of ["fuera de Puerto Rico", "Solo aceptamos enlaces de Apple Maps, Google Maps o Waze", "no trae el punto exacto", "No pudimos leer ese enlace corto", "Demasiados enlaces seguidos"]) {
    assert.ok(paste.includes(m), m);
  }
  assert.doesNotMatch(code(paste), /confirmLocationGps|verified/);
});

test("PIN preview: read-only until «Ajustar PIN»; centred on the town, never a made-up point", () => {
  assert.match(pin, /readOnly=\{!adjustable \|\| !adjusting\}/);
  assert.match(pin, /"Ajustar PIN"/);
  assert.match(pin, /"Colocar PIN"/);
  assert.match(pin, />Quitar PIN</);
  assert.match(pin, /!point && c \?/);
  assert.match(picker, /if \(readOnlyRef\.current\) return;/);
  assert.match(picker, /draggable: !readOnlyRef\.current/);
});

test("admin form: paste, preview and «Confirmar ubicación» only with the explicit checkbox", () => {
  assert.match(section, /<PasteLocation onAddress=\{applyHint\}/);
  assert.match(section, /<PinPreview point=\{form\.point\}/);
  assert.match(section, /const confirmPin = Boolean\(form\.point && form\.pinSure\)/);
  assert.match(section, /if \(confirmPin\) await confirmLocationGps\(/);
  assert.match(section, /form\?\.point && form\.pinSure \? "Confirmar ubicación" : "Guardar"/);
  assert.match(section, /Confirmo que el PIN está en la entrada del domicilio/);
  // A new or adjusted PIN clears the confirmation tick.
  assert.equal((section.match(/point: p, pinSure: false/g) || []).length, 2);
  // Without the tick the PIN is saved but unconfirmed and the usual «Ubicar en el mapa» step follows.
  assert.match(section, /setGpsFor\(r\.location\)/);
  assert.match(gps, /<PasteLocation /);
  assert.match(gps, /disabled=\{!point \|\| !sure\}/);
});

test("family: proposes an address, link or PIN through the existing correction request", () => {
  assert.match(family, /<PasteLocation label="Pega la ubicación \(opcional\)"/);
  assert.match(family, /<PinPreview point=\{point\}/);
  assert.match(family, /latitude: point\.latitude, longitude: point\.longitude/);
  assert.match(family, /createChangeRequest\(recipientId, body, token\)/);
  // The relative never edits or confirms the official address or a shift.
  assert.doesNotMatch(code(family), /updateServiceLocation|confirmLocationGps|createServiceLocation|shift/i);
  assert.match(api, /latitude\?: number; longitude\?: number/);
  assert.match(family, /point && !inPuertoRico\(point\)/); // checked on the phone before sending
  assert.match(section, /form\.point && !inPuertoRico\(form\.point\)/);
});

test("agency review: sees the proposed PIN and decides whether to use it (left unconfirmed)", () => {
  assert.match(section, /data-testid="proposed-pin"/);
  assert.match(section, /adjustable=\{false\}/);
  assert.match(section, /Usar el PIN propuesto \(quedará sin confirmar/);
  assert.match(section, /usePoint: approveUsePoint/);
  assert.match(section, /samePoint\(gpsAfterApprove, primaryLocation\)/); // opens on the reloaded, approved PIN
  assert.match(api, /usePoint\?: boolean/);
});

test("«Cómo llegar», «Voy en camino» and «Llegué» are untouched", () => {
  const nav = read("src/features/serviceLocation/navigation.ts");
  assert.doesNotMatch(nav, /mapLinks|PasteLocation|resolve-link/);
  assert.doesNotMatch(read("src/features/serviceLocation/ArrivalCard.tsx"), /mapLinks|PasteLocation/);
});

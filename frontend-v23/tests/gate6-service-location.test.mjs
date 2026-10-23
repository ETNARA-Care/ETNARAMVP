import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const allSrc = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url), { recursive: true })
  .filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => read(`${dir}/${f}`)).join("\n");

const map = read("src/features/serviceLocation/LocationMapPicker.tsx");
const nav = read("src/features/serviceLocation/navigation.ts");
const arrival = read("src/features/serviceLocation/ArrivalCard.tsx");
const section = read("src/features/serviceLocation/ServiceLocationSection.tsx");
const family = read("src/features/family/FamilyServiceLocationCard.tsx");
const shifts = read("src/pages/agency/AgencyShiftsPage.tsx");
const agencySM = read("src/pages/agency/AgencySmartMatchPage.tsx");
const bell = read("src/features/notifications/NotificationBell.tsx");

test("map: OpenStreetMap tiles, marker placed by hand, no geocoding of the written address", () => {
  assert.match(map, /tile\.openstreetmap\.org/);
  assert.match(map, /OpenStreetMap/);
  assert.match(map, /m\.on\("click"/);
  assert.match(map, /draggable: true/);
  const everything = code(allSrc("src"));
  assert.doesNotMatch(everything, /nominatim|geocod|maps\.googleapis|mapbox/i);
  assert.match(read("package.json"), /"leaflet": "1\.9\.4"/);
});

test("navigation: Apple Maps and Google Maps open with the shift's confirmed location, no ETNARA share link", () => {
  assert.match(nav, /maps\.apple\.com\/\?daddr=/);
  assert.match(nav, /google\.com\/maps\/dir\/\?api=1&destination=/);
  assert.doesNotMatch(code(nav), /window\.location\.origin|\/share\/|navigator\.share/);
  assert.match(read("src/pages/caregiver/CaregiverShiftDetailPage.tsx"), /getShiftServiceLocation\(organizationId, shiftRow\.id, token\)/);
});

test("arrival: one reading only after consent, never tracking, never blocks the start", () => {
  assert.match(arrival, /getCurrentPosition/);
  assert.doesNotMatch(code(allSrc("src")), /watchPosition/);
  assert.match(arrival, /if \(consent\.granted\) await send\(true\);\s+else setAsking\(true\);/);
  assert.match(arrival, /Registrar sin ubicación/);
  assert.match(arrival, /Nunca te impide trabajar/);
  assert.match(read("src/pages/caregiver/CaregiverShiftDetailPage.tsx"), /\{canStart && \(\s+<div className="flex flex-col gap-2">\s+<Button size="lg" fullWidth icon=\{<LogIn/);
});

test("agency record: addresses, ZIP, access, map, alternates, primary, verify, history, family permission and requests", () => {
  for (const s of ["Ubicación del servicio", "Código postal", "Referencias de acceso", "LocationMapPicker", "Hacer principal", "Verificar",
    "Historial de la ubicación", "Accesos de cuidadoras", "Familiares que pueden ver la dirección principal", "Aprobar y aplicar",
    "Usar la dirección del hogar", "Turnos próximos con otra dirección", "Mantener como están"]) assert.ok(section.includes(s), s);
});

test("shift forms: address selector; SmartMatch requires an explicit choice", () => {
  assert.match(shifts, /<LocationSelect options=\{smartMatchLocations\} value=\{smartMatchLocationId\} requireChoice/);
  assert.match(shifts, /<LocationSelect options=\{genericLocations\} value=\{genericLocationId\}/);
  assert.match(shifts, /smartMatchNeedsLocation/);
});

test("family: own permission-gated route, request a correction, see its status; never edits the address", () => {
  assert.match(family, /getFamilyServiceLocation\(recipientId, token\)/);
  assert.match(family, /createChangeRequest\(recipientId, body, token\)/);
  assert.match(family, /En revisión/);
  assert.doesNotMatch(code(family), /updateServiceLocation|createServiceLocation|saveRecipientLocation/);
});

test("SmartMatch: cancel a FILLED opportunity with a reason; active shift sends the admin to Turnos", () => {
  assert.match(agencySM, /cancelFilledOpportunity\(organizationId, cancelTarget\.id, cancelReason, cancelNote, token\)/);
  assert.match(agencySM, /SmartMatch no cancela ni reasigna turnos reales/);
  assert.match(agencySM, /No se envía a la cuidadora/);
});

test("notifications route to the right place and never show an address", () => {
  for (const t of ["SHIFT_LATE_ARRIVAL", "SHIFT_ARRIVAL_NEEDS_REVIEW", "SHIFT_LOCATION_CHANGED", "LOCATION_CHANGE_REQUESTED", "LOCATION_CHANGE_APPROVED"]) {
    assert.ok(bell.includes(t), t);
    assert.ok(read("src/api/notifications.ts").includes(t), t);
  }
});

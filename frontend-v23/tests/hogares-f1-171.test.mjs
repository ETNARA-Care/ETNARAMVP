// 171 (hogares F1, 25-nov-2026): establecimientos, unidades, habitaciones, camas, ubicación, geocerca y cierre.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const layout = read("src/layouts/AgencyLayout.tsx");
const modality = read("src/features/residential/modality.ts");
const api = read("src/api/residential.ts");
const list = read("src/pages/agency/residential/ResidentialEstablishmentsPage.tsx");
const detail = read("src/pages/agency/residential/ResidentialEstablishmentPage.tsx");
const occ = read("src/pages/agency/residential/OccupancySummary.tsx");
const pages = list + detail + occ;

test("rutas y menú de F1 solo para hogares", () => {
  assert.match(modality, /RESIDENTIAL_ESTABLISHMENTS_PATH = "\/agency\/hogar\/establecimientos"/);
  assert.match(app, /<Route path="hogar\/establecimientos" element=\{<ResidentialEstablishmentsPage\/>\}\/>/);
  assert.match(app, /<Route path="hogar\/establecimientos\/:establishmentId" element=\{<ResidentialEstablishmentPage\/>\}\/>/);
  const res = layout.slice(layout.indexOf("const RESIDENTIAL:"), layout.indexOf("const RESIDENTIAL_GROUPS"));
  assert.match(res, /RESIDENTIAL_ESTABLISHMENTS_PATH/);
  const groups = layout.slice(layout.indexOf("const GROUPS:"), layout.indexOf("/* 160 (PR B)"));
  assert.doesNotMatch(groups, /RESIDENTIAL_/);
  for (const page of [list, detail]) assert.match(page, /if \(!residential\) return <Navigate to="\/agency" replace \/>/);
});

test("usa solo el backend real (cliente compartido, rutas /residential) y vuelve a leer tras cada cambio", () => {
  for (const p of ["/establishments", "/units/", "/rooms/", "/residents/", "/placement", "/geofence", "/closure-check", "/close"]) assert.ok(api.includes(p), p);
  assert.match(api, /apiClient\.(get|post|patch|put)/);
  assert.doesNotMatch(pages, /mock|fixture|localStorage/i);
  assert.match(detail, /toast\.show\(ok, "success"\); setDialog\(null\); await load\(\);/);
});

test("camas: nunca se presentan como capacidad autorizada; superarlas solo avisa", () => {
  assert.match(occ, /No equivale a la capacidad autorizada por el Departamento de la Familia/);
  assert.doesNotMatch(pages.replace(/No equivale a la capacidad autorizada por el Departamento de la Familia/g, ""), /capacidad autorizada|autorizad[ao] por el Departamento/i);
  assert.match(occ, /Es solo un aviso: no se bloquea nada/);
  assert.match(detail, /Puedes guardar igualmente: es solo un aviso/);
  assert.match(occ, /"Sin configurar"/);
});

test("geocerca: 50–300 m, motivo obligatorio, sin rastreo ni ubicaciones de personas", () => {
  assert.match(detail, /r >= 50 && r <= 300/);
  assert.match(detail, /reason\.trim\(\)\.length >= 3/);
  assert.match(detail, /nunca impide un ponche, no rastrea y no guarda la ubicación de las personas/);
  assert.doesNotMatch(detail, /navigator\.geolocation/);
});

test("cierre: comprobación previa, motivo y confirmación escrita; nada se borra", () => {
  assert.match(detail, /residentialApi\.closureCheck/);
  assert.match(detail, /check\?\.canClose === true && reason\.trim\(\)\.length >= 3 && typed\.trim\(\) === name\.trim\(\)/);
  assert.match(detail, /No se borra nada/);
});

test("nunca muestra piezas técnicas ni datos clínicos", () => {
  assert.doesNotMatch(pages, /__etnara|technical|técnic/i);
  assert.doesNotMatch(pages, /diagn|medicament|alergi|clínic/i);
});

test("errores de las reglas del backend con mensajes claros", () => {
  for (const code of ["RESIDENTIAL_NAME_TAKEN", "RESIDENTIAL_UNIT_HAS_ACTIVE_ROOMS", "RESIDENTIAL_ROOM_HAS_RESIDENTS", "RESIDENTIAL_CLOSURE_FUTURE_SHIFTS", "RESIDENTIAL_CLOSURE_ACTIVE_RESIDENTS", "RESIDENTIAL_CLOSURE_REQUIRED"]) assert.match(api, new RegExp(`${code}: "`));
});

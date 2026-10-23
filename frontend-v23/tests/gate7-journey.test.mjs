import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const dir = (d) => readdirSync(new URL(`../${d}`, import.meta.url)).map((f) => read(`${d}/${f}`)).join("\n");

const journeyUi = code(dir("src/features/journey"));
const api = read("src/api/journey.ts");
const caregiver = read("src/features/journey/CaregiverJourneyCard.tsx");
const family = read("src/features/journey/FamilyJourneyProgress.tsx");
const text = read("src/features/journey/journeyText.ts");

test("no GPS, no tracking, no estimated time anywhere in «En camino»", () => {
  assert.doesNotMatch(journeyUi + api, /geolocation|getCurrentPosition|watchPosition|latitude|longitude/);
  assert.doesNotMatch(journeyUi, /\bETA\b|hora estimada de llegada:/);
  assert.match(family, /No es una hora estimada de llegada/);
  assert.match(caregiver, /No se usa tu ubicación/);
});

test("caregiver: «Voy en camino» inside the window, delay from fixed minutes and categories only", () => {
  assert.match(caregiver, /WINDOW_BEFORE_MS = 2 \* 3600_000/);
  assert.match(caregiver, /WINDOW_AFTER_MS = 3600_000/);
  assert.match(api, /DELAY_MINUTES = \[10, 15, 30, 45, 60\]/);
  assert.match(caregiver, /disabled=\{!minutes \|\| !reason\}/);
  assert.doesNotMatch(code(caregiver), /<Textarea|<Input/);
  assert.match(api, /clientEventId: crypto\.randomUUID\(\)/);
  assert.match(read("src/pages/caregiver/CaregiverShiftDetailPage.tsx"), /<CaregiverJourneyCard key=/);
});

test("family: progress with declared times; arrival review never shown; cancellation shown as such", () => {
  for (const s of ["Cuidadora asignada", "En camino", "Llegada registrada", "Servicio iniciado", "Servicio finalizado"]) assert.ok(family.includes(s), s);
  assert.doesNotMatch(code(family), /arrivalNeedsReview|revisi/);
  assert.match(family, /Este turno fue cancelado por la agencia/);
  assert.match(read("src/pages/family/FamilyTodayPage.tsx"), /<FamilyJourneyProgress journey=\{shift\.journey\} \/>/);
});

test("agency: «Hoy en ruta» with preventive wording and «Historial operativo»", () => {
  assert.match(text, /NOT_EN_ROUTE: "Aún no registra salida"/);
  assert.match(read("src/features/journey/TodayJourneysPanel.tsx"), /es preventivo/);
  assert.match(read("src/pages/agency/AgencyOperationsPage.tsx"), /<TodayJourneysPanel organizationId=/);
  assert.match(read("src/pages/agency/AgencyShiftDetailPage.tsx"), /<ShiftJourneyHistory organizationId=/);
});

test("notifications: labels and routes for the new notices", () => {
  const bell = read("src/features/notifications/NotificationBell.tsx");
  const n = read("src/api/notifications.ts");
  for (const t of ["FAMILY_CAREGIVER_EN_ROUTE", "FAMILY_CAREGIVER_DELAYED", "FAMILY_CAREGIVER_ARRIVED", "SHIFT_NOT_EN_ROUTE", "SHIFT_DELAY_REPORTED"]) {
    assert.ok(bell.includes(t), t); assert.ok(n.includes(t), t);
  }
});

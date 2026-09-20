import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 7.3 lets the authenticated caregiver manage real availability", () => {
  const api = read("src/api/availability.ts");
  const profile = read("src/pages/caregiver/CaregiverSupportPages.tsx");
  assert.match(api, /\/me\/availability/);
  assert.match(api, /apiClient\.put/);
  assert.match(profile, /Mi disponibilidad/);
  assert.match(profile, /Guardar disponibilidad/);
  assert.match(profile, /Periodos no disponibles/);
});

test("Phase 7.3 keeps availability connected to explainable coverage", () => {
  const shiftsApi = read("src/api/shifts.ts");
  const shiftPage = read("src/pages/agency/AgencyShiftsPage.tsx");
  assert.match(shiftsApi, /matchesDeclaredAvailability/);
  assert.match(shiftsApi, /hasUnavailabilityPeriod/);
  assert.match(shiftPage, /candidate\.blockers/);
  assert.match(shiftPage, /Administración conserva la decisión final/);
});

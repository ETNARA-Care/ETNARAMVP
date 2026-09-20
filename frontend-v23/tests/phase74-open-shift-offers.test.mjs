import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 7.4 uses real open-shift offer APIs", () => {
  const api = read("src/api/coverageOffers.ts");
  assert.match(api, /coverage-campaigns/);
  assert.match(api, /me\/coverage-offers/);
  assert.match(api, /respondCoverageOffer/);
});

test("caregivers respond without seeing resident or clinical information", () => {
  const page = read("src/pages/caregiver/CaregiverShiftsPage.tsx");
  assert.match(page, /Estoy disponible/);
  assert.match(page, /sin información clínica hasta la asignación/);
  assert.match(page, /Administración tomará la decisión final/);
});

test("Administration sends offers but retains final assignment", () => {
  const page = read("src/pages/agency/AgencyShiftsPage.tsx");
  assert.match(page, /Ofrecer turno/);
  assert.match(page, /Asignar cuidadora/);
  assert.match(page, /Interesadas:/);
  assert.match(page, /No se compartirá información del residente/);
});

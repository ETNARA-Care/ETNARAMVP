import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 7.5 configures bounded automatic coverage waves", () => {
  const api = read("src/api/coverageOffers.ts");
  assert.match(api, /waveSize: 3/);
  assert.match(api, /responseWindowMinutes: 30/);
  assert.match(api, /nextWaveAt/);
  assert.match(api, /campaignStatus/);
});

test("Administration sees wave progress but keeps the final assignment", () => {
  const page = read("src/pages/agency/AgencyShiftsPage.tsx");
  assert.match(page, /Próxima ola automática/);
  assert.match(page, /Escalación detenida/);
  assert.match(page, /Reintentar cobertura/);
  assert.match(page, /Asignar cuidadora/);
  assert.doesNotMatch(page, /asignación automática/i);
});

test("caregiver deadline remains privacy safe", () => {
  const page = read("src/pages/caregiver/CaregiverShiftsPage.tsx");
  assert.match(page, /Responde antes de las/);
  assert.match(page, /sin información clínica hasta la asignación/);
  assert.doesNotMatch(page, /careRecipientId/);
});

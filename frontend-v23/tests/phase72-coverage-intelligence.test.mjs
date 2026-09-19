import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 7.2 consumes real assisted-coverage recommendations", () => {
  const api = read("src/api/shifts.ts");
  const page = read("src/pages/agency/AgencyShiftsPage.tsx");
  assert.match(api, /\/coverage\/recommendations/);
  assert.match(page, /getCoverageRecommendations/);
  assert.match(page, /Analizar cobertura/);
  assert.match(page, /Mejores opciones para este turno/);
});

test("Phase 7.2 explains ranking and preserves human confirmation", () => {
  const page = read("src/pages/agency/AgencyShiftsPage.tsx");
  assert.match(page, /continuidad/i);
  assert.match(page, /ETNARA recomienda; Administración conserva la decisión final/);
  assert.match(page, /Confirmar asignación/);
  assert.doesNotMatch(page, /autoAssign|automaticAssignment/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Agency exposes a real predictive planning destination", () => {
  const app = read("src/App.tsx");
  const layout = read("src/layouts/AgencyLayout.tsx");
  assert.match(app, /path="planning"/);
  assert.match(layout, /to: "\/agency\/planning"/);
  assert.match(layout, /label: "Planificación"/);
});

test("planning consumes the manager-only real forecast contract", () => {
  const api = read("src/api/workforcePlanning.ts");
  const page = read("src/pages/agency/AgencyWorkforcePlanningPage.tsx");
  assert.match(api, /\/workforce\/forecast/);
  assert.match(page, /getWorkforceForecast/);
  assert.match(page, /workersWithoutAvailability/);
  assert.match(page, /credentialRisks/);
  assert.doesNotMatch(page, /DemoStore|mock|setTimeout\(/i);
});

test("the experience explains human control and does not auto-assign", () => {
  const page = read("src/pages/agency/AgencyWorkforcePlanningPage.tsx");
  assert.match(page, /Recomienda; Administración decide y confirma cualquier acción/);
  assert.match(page, /Brecha:/);
  assert.doesNotMatch(page, /assignShift|openCoverageCampaign/);
});

test("new shifts preserve the selected worker role as forecast demand", () => {
  const shifts = read("src/pages/agency/AgencyShiftsPage.tsx");
  const api = read("src/api/shifts.ts");
  assert.match(shifts, /requiredRole: workerById\[effectiveWorkerId\]\?\.internal_role/);
  assert.match(api, /requiredRole\?: string/);
});

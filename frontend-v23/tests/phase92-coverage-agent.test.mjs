import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 9.2 connects the Coverage Agent to real shifts", () => {
  const api = read("src/api/coverageAgent.ts");
  const page = read("src/pages/agency/AgencyShiftsPage.tsx");

  assert.match(api, /coverage\/agent\/briefing/);
  assert.match(api, /generateCoverageAgentBriefing/);
  assert.match(page, /Agente de Cobertura/);
  assert.match(page, /generateCoverageAgentBriefing/);
  assert.doesNotMatch(page, /DemoStore|mock/i);
});

test("the Coverage Agent remains advisory and human-controlled", () => {
  const api = read("src/api/coverageAgent.ts");
  const page = read("src/pages/agency/AgencyShiftsPage.tsx");

  assert.match(api, /mode: "advisory"/);
  assert.match(api, /requiresHumanConfirmation: true/);
  assert.match(page, /No envía ofertas ni hace asignaciones/);
  assert.match(page, /control humano/i);
});

test("Family receives no Coverage Agent route", () => {
  const app = read("src/App.tsx");
  assert.doesNotMatch(app, /family[^\n]*coverage/i);
  assert.doesNotMatch(app, /family[^\n]*agent/i);
});

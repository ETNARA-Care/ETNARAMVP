import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const familyRoutes = (app) => app.slice(app.indexOf('<Route path="/family"'), app.indexOf('<Route path="/caregiver"'));

test("Phase 9.0 connects the Agency operations agent to the real backend", () => {
  const api = read("src/api/operations.ts");
  const page = read("src/pages/agency/AgencyOperationsPage.tsx");

  assert.match(api, /operations\/agent\/briefing/);
  assert.match(page, /Agente de Operaciones/);
  assert.match(page, /generateOperationsAgentBriefing/);
  assert.doesNotMatch(page, /DemoStore|mock/i);
});

test("the agent remains advisory and requires human review", () => {
  const api = read("src/api/operations.ts");
  const page = read("src/pages/agency/AgencyOperationsPage.tsx");

  assert.match(api, /mode: "advisory"/);
  assert.match(api, /requiresHumanConfirmation: true/);
  assert.match(page, /No ejecuta decisiones/);
  assert.match(page, /control humano/i);
});

test("Family receives no operations agent route", () => {
  const family = familyRoutes(read("src/App.tsx"));
  assert.doesNotMatch(family, /path="operations"/i);
  assert.doesNotMatch(family, /path="agents?"/i);
});

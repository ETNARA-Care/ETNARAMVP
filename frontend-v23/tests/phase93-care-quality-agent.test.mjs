import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const familyRoutes = (app) => app.slice(app.indexOf('<Route path="/family"'), app.indexOf('<Route path="/caregiver"'));

test("Phase 9.3 connects the Care Quality Agent to the real backend", () => {
  const api = read("src/api/careQualityAgent.ts");
  const page = read("src/pages/agency/AgencyCareQualityPage.tsx");

  assert.match(api, /care-quality\/agent\/briefing/);
  assert.match(api, /generateCareQualityAgentBriefing/);
  assert.match(page, /Agente de Calidad del Cuidado/);
  assert.match(page, /generateCareQualityAgentBriefing/);
  assert.doesNotMatch(page, /DemoStore|mock/i);
});

test("the Care Quality Agent is an Agency-only human-controlled surface", () => {
  const app = read("src/App.tsx");
  const page = read("src/pages/agency/AgencyCareQualityPage.tsx");

  assert.match(app, /agency[\s\S]*path="quality"/);
  assert.doesNotMatch(familyRoutes(app), /path="quality"/i);
  assert.match(page, /No modifica expedientes ni emite conclusiones clínicas/);
  assert.match(page, /control humano/i);
});

test("the API contract remains advisory", () => {
  const api = read("src/api/careQualityAgent.ts");
  assert.match(api, /mode: "advisory"/);
  assert.match(api, /requiresHumanConfirmation: true/);
});

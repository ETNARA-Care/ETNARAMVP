import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const familyRoutes = (app) => app.slice(app.indexOf('<Route path="/family"'), app.indexOf('<Route path="/caregiver"'));

test("Phase 9.1 connects the Compliance Agent to the real backend", () => {
  const api = read("src/api/compliance.ts");
  const page = read("src/pages/agency/AgencySupportPages.tsx");

  assert.match(api, /compliance\/agent\/briefing/);
  assert.match(api, /generateComplianceAgentBriefing/);
  assert.match(page, /Agente de Cumplimiento/);
  assert.match(page, /generateComplianceAgentBriefing/);
  assert.doesNotMatch(page, /DemoStore|mock/i);
});

test("the Compliance Agent remains advisory and human-controlled", () => {
  const api = read("src/api/compliance.ts");
  const page = read("src/pages/agency/AgencySupportPages.tsx");

  assert.match(api, /mode: "advisory"/);
  assert.match(api, /requiresHumanConfirmation: true/);
  assert.match(page, /No aprueba documentos ni cambia elegibilidad/);
  assert.match(page, /control humano/i);
});

test("Family receives no Compliance Agent route", () => {
  const family = familyRoutes(read("src/App.tsx"));
  assert.doesNotMatch(family, /path="compliance"/i);
  assert.doesNotMatch(family, /path="agents?"/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 9.4 exposes one center for the four existing agents", () => {
  const app = read("src/App.tsx");
  const layout = read("src/layouts/AgencyLayout.tsx");
  const page = read("src/pages/agency/AgencyAgentCenterPage.tsx");

  assert.match(app, /path="agents"/);
  assert.match(layout, /Centro de agentes/);
  for (const request of [
    "generateOperationsAgentBriefing",
    "generateComplianceAgentBriefing",
    "generateCoverageAgentBriefing",
    "generateCareQualityAgentBriefing",
  ]) assert.match(page, new RegExp(request));
  assert.match(page, /Promise\.allSettled/);
});

test("the center reflects the B2B pillars without creating a Family agent", () => {
  const page = read("src/pages/agency/AgencyAgentCenterPage.tsx");

  for (const pillar of ["Compliance", "Workforce", "Care", "Family"])
    assert.match(page, new RegExp(`name: "${pillar}"`));
  assert.match(page, /ETNARA \{pillar\.name\}/);
  assert.match(page, /control humano/);
  assert.match(page, /Family conserva endpoints y permisos propios/);
  assert.doesNotMatch(page, /generateFamilyAgent|family\/agent/i);
  assert.doesNotMatch(page, /DemoStore|mock/i);
});

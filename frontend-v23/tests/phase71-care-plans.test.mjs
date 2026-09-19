import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Administration creates versioned plans through the real backend", () => {
  const api = read("src/api/carePlans.ts");
  const profile = read("src/pages/agency/AgencyResidentProfilePage.tsx");
  assert.match(api, /apiClient\.post/);
  assert.match(api, /care-recipients\/\$\{recipientId\}\/care-plan/);
  assert.match(profile, /saveCarePlan/);
  assert.doesNotMatch(profile, /DemoStore/);
});

test("assigned caregivers read the care plan inside the shift without a mock fallback", () => {
  const detail = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.match(detail, /getActiveCarePlan/);
  assert.match(detail, /Plan de cuidado/);
  assert.match(detail, /Precauciones/);
  assert.doesNotMatch(detail, /DemoStore/);
});

test("the frontend exposes no Family care-plan route", () => {
  const app = read("src/App.tsx");
  const api = read("src/api/carePlans.ts");
  assert.doesNotMatch(app, /family.*care-plan/i);
  assert.doesNotMatch(api, /family-care-plan/);
});

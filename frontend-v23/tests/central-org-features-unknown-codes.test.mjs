import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Incident 24-oct-2026: Central > Organizaciones > «Ver resumen» left the iPhone
// screen blank. The backend added ACTIVITY_PHOTOS (115) and FINANZAS (118) to
// GET /platform/organizations/:id/features; the card read LABELS[code].title for
// a code it did not know, React threw and, with no error boundary, unmounted
// the whole app.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const card = read("src/features/platform/OrganizationFeaturesCard.tsx");
const api = read("src/api/platformOrganizations.ts");

test("central features: only codes this screen knows are rendered", () => {
  assert.match(card, /const isKnown = <T extends \{ code: string \}>\(row: T\): row is T & \{ code: PilotFeatureCode \} => Object\.prototype\.hasOwnProperty\.call\(LABELS, row\.code\);/);
  assert.match(card, /data\.features\.filter\(isKnown\)\.sort\(/);
  assert.match(card, /const history = data \? data\.history\.filter\(isKnown\) : \[\];/);
});

test("central features: no lookup of LABELS on unfiltered backend data", () => {
  assert.doesNotMatch(card, /\[\.\.\.data\.features\]/, "features must go through isKnown");
  assert.doesNotMatch(card, /data\.history\.map\(/, "history must go through isKnown");
  assert.doesNotMatch(card, /data\.history\.length/);
});

test("central features: API type admits codes the app does not know yet", () => {
  assert.match(api, /features: \{ code: string; enabled: boolean; updatedAt: string \| null \}\[\];/);
  assert.match(api, /history: \{ code: string; enabled: boolean;/);
});

test("central features: toggles stay limited to SmartMatch and En camino", () => {
  assert.match(api, /export type PilotFeatureCode = "SMARTMATCH" \| "EN_CAMINO";/, "no new switch exposed by this fix");
});

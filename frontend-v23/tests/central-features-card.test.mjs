import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const card = readFileSync(new URL("../src/features/platform/OrganizationFeaturesCard.tsx", import.meta.url), "utf8");

test("central → agency summary: switches the card does not label never reach the label lookup", () => {
  // The backend reports ACTIVITY_PHOTOS (115) and FINANZAS (118) too; LABELS[code].title on them crashed the page.
  assert.match(card, /data\.features\.filter\(\(f\) => known\(f\.code\)\)/);
  assert.match(card, /data\.history\.filter\(\(h\) => known\(h\.code\)\)/);
  assert.doesNotMatch(card, /data\.history\.(map|length)/);
  // Only SmartMatch and En camino are managed here (photos and Finanzas stay off).
  assert.match(card, /const ORDER: PilotFeatureCode\[\] = \["SMARTMATCH", "EN_CAMINO"\];/);
});

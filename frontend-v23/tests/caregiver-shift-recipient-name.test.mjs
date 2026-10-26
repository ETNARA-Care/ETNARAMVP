import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("caregiver shift lists and detail fall back to the name /me/shifts carries", () => {
  const api = read("src/api/shifts.ts");
  assert.match(api, /care_recipient_display_name\?: string \| null/);
  assert.match(api, /export function shiftRecipientName\(/);
  for (const page of [
    "src/pages/caregiver/CaregiverShiftsPage.tsx",
    "src/pages/caregiver/CaregiverTodayPage.tsx",
    "src/pages/caregiver/CaregiverShiftDetailPage.tsx",
  ]) {
    const source = read(page);
    assert.match(source, /shiftRecipientName\(/, page);
    assert.doesNotMatch(source, /\brecipientName\(/, page);
  }
});

test("a finished visit opens even when the care plan is not available to the caregiver", () => {
  const source = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  // 403 (backend 4eec59c) or null (backend #228): the visit still loads; only connectivity errors propagate.
  assert.match(source, /getActiveCarePlan\([^)]*\)\.catch\(\(planError\) => \{\s*if \(isConnectivityError\(planError\)\) throw planError;\s*return null;/);
  assert.match(source, /El plan de cuidado solo se muestra mientras la visita está asignada\./);
});

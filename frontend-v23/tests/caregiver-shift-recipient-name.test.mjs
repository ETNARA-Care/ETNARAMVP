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

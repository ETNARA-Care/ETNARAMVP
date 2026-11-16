import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("bell shows the general text for a new SmartMatch opportunity", () => {
  assert.match(read("src/api/notifications.ts"), /SMARTMATCH_OPPORTUNITY_PUBLISHED"\) return "Hay una nueva oportunidad en SmartMatch"/);
});

test("tapping it opens the caregiver's SmartMatch list", () => {
  assert.match(read("src/features/notifications/NotificationBell.tsx"), /SMARTMATCH_OPPORTUNITY_PUBLISHED"\) \{ navigate\("\/caregiver\/smartmatch"\)/);
});

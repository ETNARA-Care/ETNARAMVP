import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("pasted map links: a stray «%» never throws; out-of-range matches try the next pattern", () => {
  const nav = read("src/features/serviceLocation/navigation.ts");
  assert.match(nav, /try \{ text = decodeURIComponent\(text\); \} catch/);
  assert.doesNotMatch(nav, /return \{ latitude, longitude \};\n\s*return null;\n\s*\}/);
});

test("offline cache forgets a shift's address once access ends (401/403/404), also on the phone", () => {
  // Forgotten in memory AND re-saved, so the encrypted phone cache (Phase 12.5) drops it too.
  assert.match(read("src/api/client.ts"), /\(status===401\|\|status===403\|\|status===404\)&&lastResponses\.delete\(key\)\)rememberedListener\?\.\(\)/);
});

test("the encrypted phone cache keeps the shift's confirmed address only under its upcoming-shift rule", () => {
  const cache = read("src/offline/shiftCache.ts");
  assert.match(cache, /const SHIFT_PART = .*\(visit-verification\|care-events\|service-location\)\$\/;/);
  // the person's full address list is never prefetched for caregivers
  assert.doesNotMatch(read("src/features/caregiver/prefetchShifts.ts"), /getRecipientLocation/);
});

test("family notice for an arrival says only «Llegada registrada»", () => {
  assert.match(read("src/api/notifications.ts"), /FAMILY_CAREGIVER_ARRIVED"\) return "Llegada registrada"/);
});

test("«Llegué» outside its window explains when it opens", () => {
  assert.match(read("src/features/serviceLocation/ArrivalCard.tsx"), /ARRIVAL_OUTSIDE_WINDOW/);
});

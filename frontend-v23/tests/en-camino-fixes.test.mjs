import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("«Voy en camino» and «Llegué» go through the offline queue with id + real time", () => {
  const types = read("src/features/caregiver/careEventQueue.ts");
  assert.match(types, /QueuedKind = "care_event" \| "check_in" \| "check_out" \| "en_route" \| "arrival"/);
  const provider = read("src/features/caregiver/CareEventQueueProvider.tsx");
  assert.match(provider, /item\.kind === "en_route"\) \{ await declareEnRoute\(item\.organizationId, item\.shiftId, token, item\.input/);
  // offline arrivals never carry a location
  assert.match(provider, /item\.kind === "arrival"\) \{ await recordArrival\(item\.organizationId, item\.shiftId, null, token/);
  assert.match(read("src/features/journey/CaregiverJourneyCard.tsx"), /queue\.enRoute\(organizationId, shiftId\)/);
  assert.match(read("src/features/serviceLocation/ArrivalCard.tsx"), /if \(isConnectivityError\(e\)\) \{ await queueArrival\(\); return; \}/);
});

test("the journey card refreshes itself and reacts to cancellation / reassignment", () => {
  const card = read("src/features/journey/CaregiverJourneyCard.tsx");
  assert.match(card, /const REFRESH_MS = 45_000/);
  assert.match(card, /addEventListener\("visibilitychange", refresh\)/);
  assert.match(card, /addEventListener\("online", refresh\)/);
  assert.match(card, /next\.state === "CANCELLED"\) goneRef\.current\?\.\("cancelled"\)/);
  assert.match(card, /err\?\.status === 404\) \{ setJourney\(null\); goneRef\.current\?\.\("unassigned"\)/);
  assert.match(read("src/pages/caregiver/CaregiverShiftDetailPage.tsx"), /data-testid="shift-unassigned-notice"/);
});

test("still no GPS tracking: one reading only, never watchPosition", () => {
  for (const f of ["src/features/serviceLocation/ArrivalCard.tsx", "src/features/journey/CaregiverJourneyCard.tsx", "src/features/caregiver/CareEventQueueProvider.tsx"]) {
    assert.doesNotMatch(read(f), /watchPosition/);
  }
});

test("the journey state is offline-readable under the upcoming-shift rule", () => {
  assert.match(read("src/api/client.ts"), /visit-verification\|care-events\|service-location\|journey\)\$/);
  assert.match(read("src/features/caregiver/prefetchShifts.ts"), /getShiftJourney\(organizationId, shift\.id, token\)/);
});

test("new notices have Spanish labels and safe links (a removed caregiver goes to her list)", () => {
  const labels = read("src/api/notifications.ts");
  for (const t of ["SHIFT_CANCELLED", "SHIFT_UNASSIGNED", "FAMILY_VISIT_CANCELLED", "FAMILY_CAREGIVER_CHANGED"]) assert.match(labels, new RegExp(`type === "${t}"\\) return "`));
  const bell = read("src/features/notifications/NotificationBell.tsx");
  assert.match(bell, /type === "SHIFT_UNASSIGNED"\) \{ navigate\("\/caregiver\/shifts"\); return; \}/);
  assert.ok(bell.indexOf('"SHIFT_UNASSIGNED"') < bell.indexOf('type.startsWith("SHIFT_ASSIGNMENT_")'));
});

test("agency history marks records made without signal (phone time kept)", () => {
  const src = readFileSync(new URL("../src/features/journey/ShiftJourneyHistory.tsx", import.meta.url), "utf8");
  assert.match(src, /d\.offline === true/);
  assert.match(src, /Registrado sin señal \(hora del teléfono\)/);
});

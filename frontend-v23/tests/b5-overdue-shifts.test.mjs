import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("B5: an overdue shift that never started is detected by status and scheduled end only", () => {
  const timing = read("src/features/caregiver/shiftTiming.ts");
  assert.match(timing, /\(shift\.status === "unassigned" \|\| shift\.status === "confirmed"\) && new Date\(shift\.scheduled_end\)\.getTime\(\) <= now/);
  assert.match(timing, /START_OPENS_BEFORE_MS = 2 \* 60 \* 60 \* 1000/);
  // Nothing is cancelled or rewritten from the portal.
  assert.doesNotMatch(timing, /fetch\(|apiClient|cancelShift|import /);
});

test("B5: the list shows overdue shifts apart, not as active «Asignados»", () => {
  const page = read("src/pages/caregiver/CaregiverShiftsPage.tsx");
  assert.match(page, /const open = ordered\.filter\(\(shift\) => shift\.status !== "completed" && shift\.status !== "cancelled" && !isOverdueUnstarted\(shift\)\)/);
  assert.match(page, /data-testid="overdue-shifts"/);
  assert.match(page, />Sin registro</);
});

test("B5: an overdue shift offers no «En camino», «Llegué» or «Comenzar»; early start waits until 2 h before", () => {
  const page = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.match(page, /const overdue = visitStatus === "not_started" && isOverdueUnstarted\(shift, openedAt\);/);
  assert.match(page, /shift\.status !== "completed" && !overdue;/);
  assert.match(page, /data-testid="overdue-notice"/);
  assert.match(page, /disabled=\{saving \|\| tooEarly\}/);
  assert.match(page, /CHECK_IN_OUTSIDE_WINDOW/);
  // A past visit without a plan says why, not that the agency never published one.
  assert.match(page, /status === "completed" \|\| overdue \? "El plan de cuidado solo se muestra mientras la visita está asignada\."/);
  // A visit already in progress keeps «Finalizar» whatever the time (it can run late).
  assert.match(page, /const canFinish = visitStatus === "in_progress";/);
  const queue = read("src/features/caregiver/careEventQueue.ts");
  assert.match(queue, /CHECK_IN_OUTSIDE_WINDOW/);
});

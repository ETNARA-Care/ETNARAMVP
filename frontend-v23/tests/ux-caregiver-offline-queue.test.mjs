import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const queue = read("src/features/caregiver/careEventQueue.ts");
const provider = read("src/features/caregiver/CareEventQueueProvider.tsx");
const detail = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
const layout = read("src/layouts/CaregiverLayout.tsx");

test("pending care records stay in memory only, never on the device", () => {
  for (const source of [queue, provider]) assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|caches\./);
});

test("every queued record carries one device id and its real time, reused on retry", () => {
  assert.match(provider, /clientEventId: crypto\.randomUUID\(\)/);
  assert.match(provider, /occurredAt: new Date\(\)\.toISOString\(\)/);
  assert.match(provider, /await createCareEvent\(item\.organizationId, item\.shiftId, item\.input, token\)/);
});

test("only connectivity failures are queued; server rejections surface as failures", () => {
  assert.match(queue, /apiError\?\.status === 0 \|\| apiError\?\.isNetworkError === true/);
  assert.match(provider, /if \(!isConnectivityError\(error\)\) throw error;/);
  assert.match(provider, /status: "failed", failure: failureMessage\(error\)/);
});

test("retries on reconnect, on return to the app and on an interval, and warns before closing", () => {
  assert.match(provider, /addEventListener\("online"/);
  assert.match(provider, /addEventListener\("visibilitychange"/);
  assert.match(provider, /addEventListener\("beforeunload"/);
  assert.match(provider, /setInterval\(/);
});

test("the caregiver portal shows the queue and cannot finish a shift with pending records", () => {
  assert.match(layout, /<CareEventQueueProvider>/);
  assert.match(layout, /<CareEventQueueBanner \/>/);
  assert.match(detail, /queue\.submit\(/);
  assert.match(detail, /disabled=\{saving \|\| waitingHere\.length > 0\}/);
  assert.match(detail, /pendiente de enviar/);
});

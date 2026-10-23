import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const queue = read("src/features/caregiver/careEventQueue.ts");
const provider = read("src/features/caregiver/CareEventQueueProvider.tsx");
const detail = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
const layout = read("src/layouts/CaregiverLayout.tsx");

test("pending records never touch plain browser storage (12.4: only the encrypted store)", () => {
  for (const source of [queue, provider]) assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|caches\./);
  assert.match(provider, /from "@\/offline\/secureStore"/);
});

test("every queued record carries one device id and its real time, reused on retry", () => {
  assert.match(provider, /const clientEventId = crypto\.randomUUID\(\);/);
  assert.match(provider, /input: \{ \.\.\.input, clientEventId, occurredAt: now \}/);
  assert.match(provider, /await createCareEvent\(item\.organizationId, item\.shiftId, item\.input as CreateCareEventInput, token\)/);
});

test("only connectivity failures are queued; server rejections surface as failures", () => {
  assert.match(queue, /apiError\?\.status === 0 \|\| apiError\?\.isNetworkError === true/);
  assert.match(provider, /if \(!isConnectivityError\(error\)\) throw error;/);
  assert.match(provider, /status: "failed", failure: failureMessage\(error\)/);
});

test("retries on reconnect, on return to the app and on an interval; warns before closing only if not saved", () => {
  assert.match(provider, /addEventListener\("online"/);
  assert.match(provider, /addEventListener\("visibilitychange"/);
  assert.match(provider, /if \(!persisted\) event\.preventDefault\(\);/);
  assert.match(provider, /setInterval\(/);
});

test("the caregiver portal shows the queue; finishing with pending records needs the saved queue", () => {
  assert.match(layout, /<CareEventQueueProvider>/);
  assert.match(layout, /<CareEventQueueBanner \/>/);
  assert.match(detail, /queue\.submit\(/);
  assert.match(detail, /const finishBlocked = waitingHere\.length > 0 && !queue\.persisted;/);
  assert.match(detail, /disabled=\{saving \|\| finishBlocked\}/);
  assert.match(detail, /pendiente de enviar/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const store = read("src/offline/secureStore.ts");
const token = read("src/auth/token.ts");
const auth = read("src/auth/AuthProvider.tsx");
const provider = read("src/features/caregiver/CareEventQueueProvider.tsx");
const client = read("src/api/client.ts");
const shifts = read("src/api/shifts.ts");
const detail = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
const timesheets = read("src/pages/agency/AgencyTimesheetsPage.tsx");

test("the device store is AES-GCM with a non-extractable key and a 7-day limit", () => {
  assert.match(store, /generateKey\(\{ name: "AES-GCM", length: 256 \}, false, \["encrypt", "decrypt"\]\)/);
  assert.match(store, /crypto\.getRandomValues\(new Uint8Array\(12\)\)/);
  assert.match(store, /export const MAX_AGE_MS = 7 \* 24 \* 3600 \* 1000;/);
  assert.match(store, /Math\.min\(expiresAt, Date\.now\(\) \+ MAX_AGE_MS\)/);
  assert.match(store, /if \(sealed\.expiresAt <= Date\.now\(\)\) \{\s+await secureDelete\(name\);/);
});

test("only a caregiver-only session is kept; ending it erases the session, not unsent records (C3)", () => {
  assert.match(token, /if \(options\?\.keepSignedIn && options\.expiresAt\)/);
  assert.match(token, /forgetRememberedResponses\(\);\s+for \(const name of SESSION_SECURE_ITEMS\) void secureDelete\(name\);/);
  assert.match(auth, /setToken\(token, \{ keepSignedIn, expiresAt \}\)/);
  assert.match(auth, /await restoreToken\(\);/);
  assert.match(auth, /apiErr\.status !== 401 && isKeptSession\(\)/);
});

test("the queue is saved per user and dropped after 7 days", () => {
  const vault = read("src/offline/pendingVault.ts");
  assert.match(vault, /if \(!stored \|\| stored\.userId !== userId\) return \[\];/);
  assert.match(vault, /new Date\(item\.createdAt\)\.getTime\(\) > cutoff/);
  assert.match(vault, /if \(kept\.length === 0\) \{\s+await secureDelete\(vaultName\(userId\)\);/);
  assert.match(provider, /void savePending\(queue\.owner, queue\.items\);/);
});

test("check-in and check-out go through the queue with their own id and real time", () => {
  assert.match(provider, /enqueue\(newEntry\("check_in", organizationId, shiftId, "Inicio del turno"\)\)/);
  assert.match(provider, /enqueue\(newEntry\("check_out", organizationId, shiftId, "Final del turno"\)\)/);
  assert.match(shifts, /\{verificationMethodCode:"CAREGIVER_SESSION",\.\.\.offline\}/);
  assert.match(detail, /await queue\.checkIn\(organizationId, shiftId\)/);
  assert.match(detail, /await queue\.checkOut\(organizationId, shiftId\)/);
  assert.match(detail, /El inicio del turno quedó guardado con la hora real/);
});

test("shift screens keep the last data in memory only, never on disk", () => {
  assert.match(client, /const lastResponses=new Map<string,unknown>\(\);/);
  assert.match(client, /\(error as ApiError\)\.status===0&&lastResponses\.has\(key\)/);
  assert.doesNotMatch(client, /localStorage|indexedDB|secureSet/);
});

test("the agency sees 'Registrada sin conexión'", () => {
  assert.match(timesheets, /t\.recorded_offline&&/);
  assert.match(timesheets, /Registrada sin conexión/);
  assert.match(detail, /event\.recordedOffline \? " · sin conexión" : ""/);
});

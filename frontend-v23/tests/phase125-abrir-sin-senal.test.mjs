import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sw = read("public/sw.js");
const main = read("src/main.tsx");
const cache = read("src/offline/shiftCache.ts");
const auth = read("src/auth/AuthProvider.tsx");
const vite = read("vite.config.ts");

test("the service worker keeps only the app program, never server data", () => {
  assert.match(sw, /if \(!sameOrigin && !isFont\) return; \/\/ API y todo lo demás: sin tocar\./);
  assert.match(sw, /if \(request\.method !== "GET"\) return;/);
  assert.doesNotMatch(sw, /indexedDB|organizations|Authorization/);
  assert.match(sw, /key\.startsWith\("etnara-app-"\) && key !== CACHE/);
  assert.match(vite, /replace\('__ETNARA_BUILD__', build\)/);
  assert.match(main, /import\.meta\.env\.PROD && "serviceWorker" in navigator/);
});

test("only upcoming own shifts (36 h) are saved, encrypted, and they expire", () => {
  assert.match(cache, /const AHEAD_MS = 36 \* 3600 \* 1000;/);
  assert.match(cache, /if \(shift\.status === "cancelled" \|\| shift\.status === "completed"\) return false;/);
  assert.match(cache, /\.filter\(\(r\) => recipientIds\.has\(r\.id\)\)/);
  assert.match(cache, /Math\.min\(lastEnd \+ 12 \* 3600 \* 1000, now \+ MAX_AGE_MS\)/);
  assert.match(cache, /from "\.\/secureStore"/);
  assert.doesNotMatch(cache, /localStorage|sessionStorage|caches\./);
});

test("only a kept caregiver session saves or restores shifts, and only for the same session", () => {
  assert.match(cache, /if \(!token \|\| !isKeptSession\(\)\) return;/);
  assert.match(cache, /stored\.token !== token/);
  assert.match(auth, /await restoreShiftCache\(\);/);
  assert.match(auth, /if \(status !== "authenticated" \|\| !isKeptSession\(\)\) return;\s+startShiftCache\(\);/);
});

test("the caregiver sees when a shift is ready offline and can download it before leaving", () => {
  const ready = read("src/features/caregiver/OfflineReady.tsx");
  const detail = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  const list = read("src/pages/caregiver/CaregiverShiftsPage.tsx");
  assert.match(ready, /Listo para usar sin señal/);
  assert.match(ready, /Descargar para usar sin señal/);
  assert.match(ready, /const saved = complete && await saveShiftCacheNow\(\);/);
  assert.match(ready, /if \(!isKeptSession\(\) \|\| !isUpcoming\(shift\)\) return null;/);
  assert.match(detail, /<OfflineReadyCard organizationId=\{organizationId\} shift=\{shift\} \/>/);
  assert.match(list, /<OfflineReadyMark shiftId=\{shift\.id\} compact \/>/);
});

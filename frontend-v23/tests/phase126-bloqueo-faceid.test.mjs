import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const lock = read("src/offline/appLock.ts");
const ui = read("src/features/caregiver/AppLock.tsx");
const layout = read("src/layouts/CaregiverLayout.tsx");

test("the lock uses the phone's own biometrics and requires verification", () => {
  assert.match(lock, /authenticatorAttachment: "platform", userVerification: "required"/);
  assert.match(lock, /userVerification: "required",\s+timeout/);
  assert.match(lock, /\(new Uint8Array\(data\)\[32\] & 0x04\) !== 0/);
  assert.match(lock, /export const LOCK_AFTER_MS = 5 \* 60 \* 1000;/);
  assert.match(lock, /from "\.\/secureStore"/);
});

test("only kept caregiver sessions are locked; on open and after 5 minutes away", () => {
  assert.match(lock, /if \(!isKeptSession\(\)\) return false;/);
  assert.match(ui, /if \(away < LOCK_AFTER_MS\) return;/);
  assert.match(ui, /lockEnabled\(\)\.then\(\(enabled\) => \{ if \(!cancelled\) setState\(enabled \? "locked" : "open"\); \}\)/);
  assert.match(layout, /<CareEventQueueProvider><AppLockGate>/);
});

test("while locked the portal is hidden, and the password exit warns about unsent records", () => {
  assert.match(ui, /<div hidden=\{state === "locked"\} aria-hidden=\{state === "locked"\}>\{children\}<\/div>/);
  assert.match(ui, /Si cierras la sesión ahora se perderán\./);
});

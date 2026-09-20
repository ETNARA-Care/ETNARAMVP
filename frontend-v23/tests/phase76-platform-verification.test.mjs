import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("platform review is protected by independent server authority", () => {
  const auth = read("src/auth/AuthProvider.tsx");
  const guard = read("src/auth/PlatformGuard.tsx");
  const app = read("src/App.tsx");
  assert.match(auth, /platformAdmin/);
  assert.match(guard, /isPlatformAdmin/);
  assert.match(app, /<PlatformGuard>/);
  assert.match(app, /path="\/platform"/);
});

test("credential queue uses only real platform APIs", () => {
  const api = read("src/api/platformCredentials.ts");
  const page = read("src/pages/platform/PlatformCredentialVerificationPage.tsx");
  assert.match(api, /\/platform\/credentials\/verification-queue/);
  assert.match(api, /\/verifications/);
  assert.match(api, /\/documents\/\$\{fileId\}\/download-url/);
  assert.match(page, /listPlatformCredentialQueue/);
  assert.match(page, /verifyPlatformCredential/);
  assert.match(page, /openPlatformCredentialDocument/);
  assert.doesNotMatch(page, /mock|DemoStore|setTimeout\(/i);
});

test("review communicates automatic eligibility and requires a rejection reason", () => {
  const page = read("src/pages/platform/PlatformCredentialVerificationPage.tsx");
  const compliance = read("src/api/compliance.ts");
  assert.match(page, /aptitud se recalcula automáticamente/);
  assert.match(page, /status === "rejected" && !notes\.trim\(\)/);
  assert.match(page, /Ver documento/);
  assert.match(compliance, /PLATFORM_VERIFICATION_REJECTED/);
});

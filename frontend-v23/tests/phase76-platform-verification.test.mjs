import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("platform review is protected by independent server authority", () => {
  const auth = read("src/auth/AuthProvider.tsx");
  const guard = read("src/auth/PlatformGuard.tsx");
  const app = read("src/App.tsx");
  const agencyLayout = read("src/layouts/AgencyLayout.tsx");
  assert.match(auth, /platformAdmin/);
  assert.match(guard, /isPlatformAdmin/);
  assert.match(app, /<PlatformGuard>/);
  assert.match(app, /path="\/platform"/);
  assert.match(agencyLayout, /isPlatformAdmin/);
  assert.match(agencyLayout, /to="\/platform"/);
  assert.match(agencyLayout, /label="Plataforma"/);
});

test("platform no longer exposes employee credential inspection APIs", () => {
  const api = read("src/api/platformCredentials.ts");
  const page = read("src/pages/platform/PlatformCredentialVerificationPage.tsx");
  assert.doesNotMatch(api, /\/platform\/credentials\/verification-queue/);
  assert.doesNotMatch(api, /\/platform\/credentials\/[^\s]*verifications/);
  assert.doesNotMatch(api, /openPlatformCredentialDocument/);
  assert.doesNotMatch(page, /listPlatformCredentialQueue/);
  assert.doesNotMatch(page, /verifyPlatformCredential/);
  assert.doesNotMatch(page, /openPlatformCredentialDocument/);
  assert.doesNotMatch(page, /worker_name|credential_type_name|Credenciales del personal/);
});

test("platform review is limited to establishment compliance documents", () => {
  const api = read("src/api/platformCredentials.ts");
  const page = read("src/pages/platform/PlatformCredentialVerificationPage.tsx");
  assert.match(api, /\/platform\/establishment-documents\/verification-queue/);
  assert.match(api, /\/platform\/establishment-documents\/\$\{id\}\/download/);
  assert.match(api, /\/platform\/establishment-documents\/\$\{id\}\/review/);
  assert.match(page, /listPlatformEstablishmentDocuments/);
  assert.match(page, /reviewPlatformEstablishmentDocument/);
  assert.match(page, /status === "rejected" && !notes\.trim\(\)/);
  assert.match(page, /Los expedientes de empleados y residentes permanecen privados/);
  assert.doesNotMatch(page, /mock|DemoStore|setTimeout\(/i);
});

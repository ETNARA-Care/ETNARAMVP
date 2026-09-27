import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 10.0 manages establishments inside the active organization", () => {
  const page = read("src/pages/agency/AgencySupportPages.tsx");
  const api = read("src/api/establishments.ts");

  assert.match(page, /const organizationId = activeOrganization\?\.id/);
  assert.match(page, /listEstablishments\(organizationId/);
  assert.match(page, /createEstablishment\(organizationId/);
  assert.match(page, /updateEstablishment\(organizationId/);
  assert.match(page, /sin mezclar datos de otras agencias/i);
  assert.match(api, /organizations\/\$\{organizationId\}\/establishments/);
});

test("multi-agency users can switch organizations without a combined view", () => {
  const page = read("src/pages/agency/AgencySupportPages.tsx");
  const auth = read("src/auth/AuthProvider.tsx");

  assert.match(page, /organizations\.length > 1/);
  assert.match(page, /navigate\("\/select-organization"\)/);
  assert.match(auth, /setActiveOrganizationById/);
  assert.doesNotMatch(page, /allOrganizations|combinedEstablishments|mergeOrganizations/i);
});

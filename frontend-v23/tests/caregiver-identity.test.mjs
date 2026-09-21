import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("caregiver header and profile use the authenticated worker identity", () => {
  const layout = read("src/layouts/CaregiverLayout.tsx");
  const profile = read("src/pages/caregiver/CaregiverSupportPages.tsx");
  const contract = read("src/api/organizationContext.ts");

  assert.match(contract, /getMyWorkerProfile/);
  assert.match(layout, /activeWorkerProfile\?\.displayName/);
  assert.match(profile, /workerProfile\?\.displayName/);
  assert.match(profile, /workerProfile\?\.internalRole/);
  assert.doesNotMatch(layout, /María Rivera/);
  assert.doesNotMatch(profile, /María Rivera|Cuidadora certificada/);
});

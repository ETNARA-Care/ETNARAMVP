import { shellEs } from "./_shellCatalog.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  assert.match(agencyLayout, /label=\{t\("agency\.platform"\)\}/); assert.equal(shellEs("agency.platform"), "Plataforma");
});

// 149 (5-nov-2026): ETNARA Central no revisa, aprueba, certifica ni descarga documentos de las agencias.
test("Central has no document verification screen, API client, metric or Tower panel", () => {
  for (const gone of ["src/api/platformCredentials.ts", "src/pages/platform/PlatformCredentialVerificationPage.tsx", "src/features/tower/TowerCompliancePanel.tsx"]) {
    assert.equal(existsSync(new URL(`../${gone}`, import.meta.url)), false, gone);
  }
  const app = read("src/App.tsx");
  assert.match(app, /<Route path="credentials" element=\{<Navigate to="\/platform" replace\/>\}\/>/);
  assert.doesNotMatch(read("src/layouts/PlatformLayout.tsx"), /\/platform\/credentials/);
  const overview = read("src/pages/platform/PlatformOverviewPage.tsx");
  assert.doesNotMatch(overview, /pendingDocuments|establishment-documents|Abrir verificación/);
  assert.match(overview, /No revisa, aprueba ni certifica documentos, licencias ni credenciales de las agencias/);
  assert.doesNotMatch(read("src/pages/platform/PlatformOrganizationsPage.tsx"), /credentialSummary|resumen agregado/);
  assert.doesNotMatch(read("src/pages/platform/PlatformTowerPage.tsx"), /Cumplimiento documental|TowerCompliancePanel/);
  assert.doesNotMatch(read("src/api/platformOrganizations.ts"), /getPlatformOrganizationCredentialSummary/);
});

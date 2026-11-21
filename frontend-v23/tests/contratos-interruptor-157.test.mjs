// Interruptor «Contratos» por agencia (157): menú, pantallas y aviso de términos solo en agencias
// donde ETNARA lo encendió. El servidor también lo exige (404) y la base rechaza nuevas evidencias.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Central puede encender o apagar «Contratos» como los demás interruptores", () => {
  assert.match(read("src/api/platformOrganizations.ts"), /\| "CONTRACTS";/);
  const card = read("src/features/platform/OrganizationFeaturesCard.tsx");
  assert.match(card, /CONTRACTS: \{ title: "Contratos"/);
  assert.match(card, /const ORDER: PilotFeatureCode\[\] = \[[^\]]*"CONTRACTS"\]/);
  assert.match(card, /no publica documentos ni salta la aprobación jurídica/);
});

test("el menú «Contratos» solo se consulta en agencias con el interruptor", () => {
  const layout = read("src/layouts/AgencyLayout.tsx");
  assert.match(layout, /const contractsOn = hasOrgFeature\(activeOrganization\?\.features, "CONTRACTS"\);/);
  assert.match(layout, /useContractsAvailable\(activeOrganization\?\.id, roles\.includes\("ORGANIZATION_ADMIN"\), contractsOn\)/);
});

test("el detalle (lectura y firma) está detrás del interruptor; la lista pasa a solo consulta de constancias", () => {
  const app = read("src/App.tsx");
  assert.match(app, /<Route path="contracts" element=\{<AgencyContractsPage\/>\}\/>/);
  assert.match(app, /<Route path="contracts\/:versionId" element=\{<FeatureRoute feature="CONTRACTS" fallback="\/agency"><AgencyContractDetailPage\/><\/FeatureRoute>\}\/>/);
});

test("el aviso de términos no consulta ni aparece sin el interruptor", () => {
  const gate = read("src/features/contracts/RoleTermsGate.tsx");
  assert.match(gate, /hasOrgFeature\(activeOrganization\?\.features, "CONTRACTS"\)/);
  assert.match(gate, /if \(!organizationId \|\| !token \|\| !enabled\) \{ setData\(null\); return; \}/);
  assert.match(gate, /if \(!enabled \|\| !organizationId/);
});

test("apagado: solo consulta de constancias anteriores, sin contratos pendientes ni firma", () => {
  const hook = read("src/features/contracts/useContractsAvailable.ts");
  assert.match(hook, /if \(!featureOn\) \{\s*contractsApi\.acceptances\(organizationId, token\)/);
  assert.match(hook, /available: h\.acceptances\.length > 0, pending: 0, status: null, readOnly: true/);
  const page = read("src/pages/agency/AgencyContractsPage.tsx");
  assert.match(page, /const readOnly = !hasOrgFeature\(activeOrganization\?\.features, "CONTRACTS"\);/);
  assert.match(page, /if \(readOnly\) \{\s*const h = await contractsApi\.acceptances\(organizationId, token\);\s*setContracts\(\[\]\); setHistory\(h\.acceptances\);/);
  assert.match(page, /data-testid="contracts-read-only"/);
  assert.match(page, /no se pueden firmar documentos nuevos/);
});

// Herramientas de Central para contratos (158): una agencia a la vez, solo documentos de PRUEBA,
// representantes, aceptaciones, retiro con motivo e interruptor; todo por las rutas del módulo.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const api = read("src/api/contracts.ts");
const panel = read("src/features/contracts/central/CentralAgencyContractsPanel.tsx");
const page = read("src/pages/platform/PlatformContractsPage.tsx");

test("Central crea solo documentos de PRUEBA, dirigidos a una agencia, no obligatorios y con las marcas", () => {
  assert.match(api, /kind: "SERVICE_AGREEMENT", isTest: true, requiredForOperation: false/);
  assert.match(api, /export const TEST_BANNER = "DOCUMENTO FICTICIO DE PRUEBA — PRUEBA — SIN VALOR CONTRACTUAL/);
  assert.match(api, /return `\[PRUEBA\] \$\{t\}/);
  assert.match(api, /return `TEST_\$\{slug\}_\$\{stamp\}`/);
  assert.match(panel, /organizationId: org\.organizationId/);
  assert.doesNotMatch(panel, /isTest: false|legal-approval|CONTRACTS_OFFICIAL/);
});

test("publicar pide confirmación; retirar y revocar piden motivo; el interruptor pide motivo", () => {
  assert.match(panel, /data-testid="central-publish-confirm"/);
  assert.match(panel, /retiring\.reason\.trim\(\)\.length < 5/);
  assert.match(panel, /revoking\.reason\.trim\(\)\.length < 5/);
  assert.match(panel, /switchReason\.trim\(\)\.length < 3/);
  assert.match(panel, /setOrganizationFeature\(orgId, "CONTRACTS", !switchOn, switchReason\.trim\(\), t\)/);
});

test("solo se designan administradoras activas de la agencia (lista del servidor) con nombre y apellido y fundamento", () => {
  assert.match(api, /\/eligible-signatories`/);
  assert.match(panel, /!\/\\S\+\\s\+\\S\+\/\.test\(des\.fullName\.trim\(\)\)/);
  assert.match(panel, /des\.basis\.trim\(\)\.length < 10/);
});

test("Central no firma por nadie y las aceptaciones se muestran solo de esta agencia", () => {
  assert.doesNotMatch(panel, /signature-code|\/accept`/);
  assert.match(panel, /\.filter\(\(a\) => a\.organization_id === orgId\)/);
});

test("la página conserva el estado de solo lectura y añade la pestaña de administración", () => {
  assert.match(page, /\{ id: "status", label: "Estado" \}, \{ id: "admin", label: "Administrar por agencia" \}/);
  assert.match(page, /data-testid="central-contracts"/);
  assert.match(page, /title="Módulo contractual apagado"/);
});

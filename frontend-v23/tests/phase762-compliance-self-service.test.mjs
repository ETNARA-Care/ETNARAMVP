import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 7.6.2 uses real manager-only compliance configuration and audit APIs", async () => {
  const api = await read("src/api/compliance.ts");
  assert.match(api, /getComplianceConfiguration/);
  assert.match(api, /saveCompliancePolicy/);
  assert.match(api, /getComplianceAudit/);
  assert.match(api, /compliance\/configuration/);
  assert.match(api, /compliance\/audit/);
  assert.doesNotMatch(api, /DemoStore|localStorage/);
});

test("the compliance center explains causes and lets managers configure each worker role", async () => {
  const page = await read("src/pages/agency/AgencySupportPages.tsx");
  assert.match(page, /Requisitos por tipo de cuidador/);
  assert.match(page, /Obligatoria para trabajar/);
  assert.match(page, /Requiere aprobación de la agencia/);
  assert.match(page, /Historial auditable/);
  assert.match(page, /Accesos e invitaciones/);
  assert.match(page, /requirementStatusLabel/);
  assert.doesNotMatch(page, /@\/mocks\//);
});

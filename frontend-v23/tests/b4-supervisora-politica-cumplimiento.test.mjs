import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Auditoría B4 (27-oct-2026): la política de requisitos de cumplimiento es configuración de la
// agencia y solo la cambia la administración (el backend responde 403 a la supervisora).
// La supervisora conserva Personal, credenciales y revisiones.
test("only the agency administrator sees «Configurar» on the compliance policy", () => {
  const page = read("src/pages/agency/AgencySupportPages.tsx");
  assert.match(page, /const canEditPolicy = roles\.includes\("ORGANIZATION_ADMIN"\);/);
  assert.match(page, /\{canEditPolicy && <Button variant="secondary" onClick=\{\(\) => openPolicy\(role\)\}>Configurar<\/Button>\}/);
  assert.match(page, /Solo la administración de la agencia puede cambiarlas\./);
  // No other unguarded entry point to the policy editor.
  assert.equal((page.match(/openPolicy\(role\)/g) ?? []).length, 1);
});

test("the supervisor keeps caregiver management: roster and «Añadir personal» are not role-gated", () => {
  const page = read("src/pages/agency/AgencySupportPages.tsx");
  const workers = page.slice(page.indexOf("export function AgencyWorkersPage"), page.indexOf("export function AgencyMessagesPage"));
  assert.doesNotMatch(workers, /ORGANIZATION_ADMIN/);
});

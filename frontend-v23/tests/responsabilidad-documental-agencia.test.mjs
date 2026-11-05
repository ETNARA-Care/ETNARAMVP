import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Decisión 5-nov-2026: cada agencia revisa y aprueba su documentación; ETNARA no verifica ni certifica.
test("A: the credential badge shows the agency's real decision; no 'ETNARA Verified' anywhere", () => {
  const badge = read("src/pages/agency/WorkerCredentialBadge.tsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const label of ["Revocada", "Vencida", "Rechazada por la agencia", "Aprobada por la agencia", "Pendiente de revisión de la agencia", "Sin documento", "Vigente", "Por vencer"]) assert.match(badge, new RegExp(label));
  assert.doesNotMatch(badge, /ETNARA Verified|Sin verificar|verification_status/);
  const profile = read("src/pages/agency/AgencyWorkerProfilePage.tsx");
  assert.doesNotMatch(profile, /"Documento aprobado" : credential\.organization_review_status/); // no second, contradictory badge
  assert.match(profile, /CREDENTIAL_SELF_REVIEW_FORBIDDEN"\) return "No puedes aprobar ni rechazar tus propias credenciales/);
  assert.match(profile, /CREDENTIAL_SELF_MANAGEMENT_FORBIDDEN"\) return "No puedes registrar ni cambiar tus propias credenciales/);
  // Agencia pequeña: delegar en otra persona autorizada de la agencia, nunca en ETNARA Central.
  assert.match(profile, /si eres la única administradora, nombra a una supervisora en Ajustes › Equipo/);
  assert.doesNotMatch(profile, /ETNARA (aprueba|revisa) tus credenciales/);
});

test("B: institutional documents show existence and expiry only; Central's old decisions are labelled history", () => {
  const panel = read("src/pages/agency/EstablishmentCompliancePanel.tsx");
  assert.match(panel, /let status:"Faltante"\|"Cargado"\|"Vencido"\|"Próximo a vencer"="Faltante"/);
  assert.doesNotMatch(panel, /"Vigente"|"Pendiente de revisión"|"Rechazado"|Pendiente de validación/);
  assert.match(panel, /Decisión histórica de ETNARA Central \(antes de nov-2026\)/);
  assert.match(panel, /No es una certificación vigente/);
  assert.match(panel, /no que haya sido validado legalmente/);
});

test("D: creating an establishment says administrative offices do not belong there", () => {
  for (const page of ["src/pages/agency/AgencyOrganizationSettingsPage.tsx", "src/pages/agency/AgencySupportPages.tsx"]) {
    const s = read(page);
    assert.match(s, /No registres aquí oficinas administrativas/);
    assert.match(s, /Las oficinas administrativas no se registran aquí/);
  }
});

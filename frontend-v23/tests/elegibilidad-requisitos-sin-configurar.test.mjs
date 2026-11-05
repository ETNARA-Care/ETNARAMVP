import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Decisión 4-nov-2026: cada agencia define y aprueba los requisitos de cada puesto. ETNARA no
// impone una lista universal. Sin política aplicable la persona sigue sin poder trabajar, pero el
// portal dice por qué y adónde ir, en lugar de "No apto" sin motivo.
const api = read("src/api/compliance.ts");
const profile = read("src/pages/agency/AgencyWorkerProfilePage.tsx");
const center = read("src/pages/agency/AgencySupportPages.tsx");
const shifts = read("src/pages/agency/AgencyShiftsPage.tsx");

test("the API type knows the backend's 'unconfigured' state and the rejected-review reason", () => {
  assert.match(api, /eligibility: "eligible" \| "not_eligible" \| "unconfigured"/);
  assert.match(api, /"ORGANIZATION_REVIEW_REJECTED"/);
  assert.match(api, /UNCONFIGURED_REQUIREMENTS_TITLE = "Requisitos sin configurar para este puesto"/);
  assert.match(api, /COMPLIANCE_POLICIES_PATH = `\/agency\/compliance#\$\{COMPLIANCE_POLICIES_ANCHOR\}`/);
});

test("worker profile: shows the unconfigured title, sends the admin to Políticas, and is never 'Apto'", () => {
  assert.match(profile, /requirementsUnconfigured\(compliance\) \? UNCONFIGURED_REQUIREMENTS_TITLE : "No apto para trabajar"/);
  assert.match(profile, /roles\.includes\("ORGANIZATION_ADMIN"\) \? \([\s\S]*navigate\(COMPLIANCE_POLICIES_PATH\)[\s\S]*Cumplimiento → Políticas/);
  assert.match(profile, /no puede recibir asignaciones ni iniciar turnos/);
  // "Apto para trabajar" still requires eligibility === "eligible" from the backend.
  assert.match(profile, /compliance\?\.eligibility === "eligible" \? "Apto para trabajar"/);
});

test("every specific reason stays visible, including a rejection", () => {
  for (const source of [profile, center, shifts]) {
    for (const code of ["MISSING_CREDENTIAL", "CREDENTIAL_EXPIRED", "CREDENTIAL_NOT_ACTIVE", "CREDENTIAL_REVOKED", "ORGANIZATION_REVIEW_MISSING", "ORGANIZATION_REVIEW_REJECTED"]) {
      assert.match(source, new RegExp(`${code}: "`), code);
    }
  }
});

test("compliance center: unconfigured is never 'al día', and the policy list never claims an ETNARA base policy", () => {
  assert.match(center, /if \(requirementsUnconfigured\(row\.compliance\)\) return "Sin requisitos";/);
  assert.match(center, /if \(requirementsUnconfigured\(row\.compliance\)\) return `\$\{UNCONFIGURED_REQUIREMENTS_TITLE\}/);
  assert.doesNotMatch(center, /Política base de ETNARA/);
  assert.match(center, /Sin requisitos configurados: nadie con este puesto puede trabajar todavía/);
  assert.match(center, /<Card id=\{COMPLIANCE_POLICIES_ANCHOR\}>/);
  assert.match(center, /scrollIntoView/);
});

test("shifts: only eligible workers can be picked; unconfigured explains why", () => {
  assert.match(shifts, /workers\.filter\(\(worker\) => worker\.compliance\.eligibility === "eligible"\)/);
  assert.match(shifts, /requirementsUnconfigured\(worker\.compliance\)\) return `\$\{UNCONFIGURED_REQUIREMENTS_TITLE\}/);
});

test("the #politicas link opens the folded Personal → Políticas sections of the compliance center", () => {
  const page = read("src/pages/agency/AgencyComplianceCenterPage.tsx");
  assert.match(page, /const toPolicies=hash===`#\$\{COMPLIANCE_POLICIES_ANCHOR\}`;const\[workersOpen,setWorkersOpen\]=useState\(toPolicies\),\[advancedOpen,setAdvancedOpen\]=useState\(toPolicies\);/);
});

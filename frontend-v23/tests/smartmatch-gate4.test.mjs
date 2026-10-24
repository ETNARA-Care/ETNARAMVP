import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const api = read("src/api/smartmatch.ts");
const caregiver = read("src/pages/caregiver/CaregiverSmartMatchPage.tsx");
const agency = read("src/pages/agency/AgencySmartMatchPage.tsx");
const app = read("src/App.tsx");
const agencyLayout = read("src/layouts/AgencyLayout.tsx");
const caregiverLayout = read("src/layouts/CaregiverLayout.tsx");

test("SmartMatch uses the real backend endpoints", () => {
  for (const path of ["available-opportunities", "my-applications", "/applications`", "/withdraw", "/review-queue", "/review`", "/decision", "/events", "/publish", "application-counts"]) {
    assert.ok(api.includes(path), `missing endpoint ${path}`);
  }
  assert.match(api, /consentVersion: SMARTMATCH_CONSENT_VERSION/);
  assert.match(api, /decision === "APPROVE" \? \{ decision, confirm: true \}/);
  assert.match(api, /visibility: "INTERNAL"/);
});

test("routes and navigation exist in the deployed frontend", () => {
  assert.match(app, /path="smartmatch" element=\{<FeatureRoute feature="SMARTMATCH" fallback="\/caregiver"><CaregiverSmartMatchPage\/><\/FeatureRoute>\}/);
  assert.match(app, /path="smartmatch" element=\{<FeatureRoute feature="SMARTMATCH" fallback="\/agency"><AgencySmartMatchPage\/><\/FeatureRoute>\}/);
  assert.match(agencyLayout, /to: "\/agency\/smartmatch"/);
  assert.match(caregiverLayout, /\{ to: "\/caregiver\/smartmatch", icon: BriefcaseBusiness, label: "Ofertas" \}/);
});

test("supervisors do not see the SmartMatch link (administrators only)", () => {
  assert.match(agencyLayout, /item\.to !== "\/agency\/smartmatch"/);
  assert.match(agency, /roles\.includes\("ORGANIZATION_ADMIN"\)/);
  assert.match(caregiver, /roles\.includes\("WORKER"\)/);
});

test("caregiver flow: filter, explicit consent, withdraw, re-apply, statuses", () => {
  assert.match(caregiver, /PUERTO_RICO_MUNICIPALITIES/);
  assert.match(caregiver, /disabled=\{!consent\}/);
  assert.match(caregiver, /Acepto y doy mi consentimiento/);
  assert.match(caregiver, /Retirar solicitud/);
  assert.match(caregiver, /Volver a solicitar/);
  assert.match(caregiver, /La agencia toma la decisión final/);
  assert.match(caregiver, /Si crea el turno, lo verás en «Turnos» para aceptarlo/);
  assert.doesNotMatch(caregiver, /minutos de viaje|min de viaje/i);
  assert.equal(read("src/features/smartmatch/municipalities.ts").match(/"/g).length / 2, 78);
});

test("agency flow: create, publish by any admin, review checks, confirmed decisions, history, filled", () => {
  assert.match(agency, /Guardar borrador/);
  assert.match(agency, />Publicar</);
  assert.match(agency, /Cualquier administrador de la agencia puede publicar/);
  assert.match(agency, /Confirmar aprobación/);
  assert.match(agency, /Confirmar rechazo/);
  assert.match(agency, /disabled=\{busy \|\| !review\.checks\.approvable\}/);
  assert.match(agency, /Historial/);
  assert.match(agency, /"Cubiertas"/);
  // Approval still never creates a shift: the shift is the next, explicit step in Turnos.
  assert.match(agency, /El turno se crea en el siguiente paso, en Turnos/);
});

test("no creator-only publishing message anywhere", () => {
  for (const file of ["src/pages/agency/AgencySmartMatchPage.tsx", "src/features/smartmatch/smartmatchText.ts"]) {
    assert.doesNotMatch(read(file), /solo el creador/i);
  }
});

test("no patient data fields in the SmartMatch client", () => {
  assert.doesNotMatch(api, /patient|first_name|last_name|address|diagnos/i);
});

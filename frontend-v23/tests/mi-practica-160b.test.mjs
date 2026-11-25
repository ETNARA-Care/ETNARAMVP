// 160 (PR B, 23-nov-2026): «Mi práctica» del cuidador independiente.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
async function load(path, stubs = "") {
  const src = read(path).replace(/^import [^;]+;$/gm, (line) => (line.startsWith("import type") ? "" : line.includes("@/api/client") ? stubs : line));
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}
const modality = await load("src/features/practice/modality.ts");
const selfAssign = await load("src/features/practice/selfAssign.ts", "const apiClient = { post: async () => { throw { code: 'X' }; } };");
const layout = read("src/layouts/AgencyLayout.tsx");
const shiftsPage = read("src/pages/agency/practice/PracticeShiftsPage.tsx");
const homePage = read("src/pages/agency/practice/PracticeHomePage.tsx");
const settings = read("src/pages/agency/AgencyOrganizationSettingsPage.tsx");
const caregiver = read("src/pages/caregiver/CaregiverSupportPages.tsx");

test("solo INDEPENDENT_PROVIDER es «Mi práctica»; agencias y hogares no cambian", () => {
  assert.equal(modality.isIndependentOrganization({ type: "INDEPENDENT_PROVIDER" }), true);
  for (const type of ["HOME_CARE_AGENCY", "RESIDENTIAL_CARE_HOME", undefined, null]) assert.equal(modality.isIndependentOrganization({ type }), false);
  assert.equal(modality.isIndependentOrganization(null), false);
});

test("secciones de agencia ocultas para el independiente (con subrutas); las propias siguen visibles", () => {
  for (const p of ["/agency/workers", "/agency/workers/abc", "/agency/compliance", "/agency/smartmatch", "/agency/planning", "/agency/timesheets", "/agency/finance", "/agency/operations/history", "/agency/agents", "/agency/quality", "/agency/shift-reports", "/agency/photos", "/agency/settings/establishments/x", "/AGENCY/WORKERS/"])
    assert.equal(modality.isHiddenForIndependent(p), true, p);
  for (const p of ["/agency", "/agency/shifts", "/agency/shifts/1", "/agency/residents", "/agency/residents/1", "/agency/incidents", "/agency/messages", "/agency/settings", "/agency/contracts", "/agency/workersx"])
    assert.equal(modality.isHiddenForIndependent(p), false, p);
});

test("el menú y la redirección se aplican solo al independiente; «Mi día de cuidador» se mantiene", () => {
  assert.match(layout, /\(independent \? PRACTICE_GROUPS : GROUPS\)/);
  assert.match(layout, /independent && isHiddenForIndependent\(location\.pathname\) \? <Navigate to="\/agency" replace \/>/);
  assert.match(layout, /\(independent \? PRACTICE_MOBILE_TABS : MOBILE_TABS\)/);
  const practice = layout.slice(layout.indexOf("const PRACTICE:"), layout.indexOf("const PRACTICE_GROUPS"));
  assert.doesNotMatch(practice, /workers|smartmatch|planning|timesheets|operations|agents|compliance|quality/);
  assert.match(layout, /roles\.includes\("WORKER"\) && <AdminSideLink to="\/caregiver\/today"/);
});

test("«Asignármelo» usa el endpoint de autoasignación y explica la elegibilidad sin aprobación ni certificación", async () => {
  assert.equal(selfAssign.selfAssignPath("o", "s"), "/organizations/o/me/shifts/s/self-assign");
  const r = (code) => selfAssign.interpretSelfAssignError({ code });
  assert.deepEqual(r("WORKER_NOT_ELIGIBLE_NOT_ELIGIBLE"), { kind: "not_eligible", unconfigured: false });
  assert.deepEqual(r("NO_APPLICABLE_REQUIREMENT_SET"), { kind: "not_eligible", unconfigured: true });
  assert.deepEqual(r("MY_SCHEDULE_CONFLICT"), { kind: "conflict" });
  assert.deepEqual(r("SELF_DECLARATION_CONFIRMATION_REQUIRED"), { kind: "confirmation_required" });
  assert.equal(r("WHATEVER").kind, "error");
  assert.equal((await selfAssign.selfAssignShift("o", "s", "t")).kind, "error");
  for (const k of [{ kind: "not_eligible", unconfigured: true }, { kind: "not_eligible", unconfigured: false }, { kind: "conflict" }])
    assert.doesNotMatch(selfAssign.selfAssignMessage(k), /aprob|verificad|certificad|agencia/i);
  assert.equal(selfAssign.SELF_DECLARATION_NOTICE, "ETNARA Care no verifica ni certifica documentos. Esta confirmación no sustituye los requisitos legales que te correspondan.");
  assert.deepEqual(selfAssign.practicePendingItems({ eligibility: "eligible", requirements: [] }), []);
  assert.deepEqual(selfAssign.practicePendingItems({ eligibility: "unconfigured", requirements: [] }), ["Documentos de práctica sin configurar"]);
  assert.deepEqual(selfAssign.practicePendingItems({ eligibility: "not_eligible", requirements: [{ isMandatory: true, status: "CREDENTIAL_EXPIRED", requirement: "CPR_CERT" }, { isMandatory: false, status: "MISSING_CREDENTIAL", requirement: "X" }] }), ["Vencido: CPR CERT"]);
});

test("las páginas de «Mi práctica» no llaman a cobertura, SmartMatch, personal ni centro operacional", () => {
  for (const page of [shiftsPage, homePage]) {
    assert.doesNotMatch(page, /@\/api\/(coverage|smartmatch|operations|team|establishments)|listWorkers\(|assignShift\(|getCoverageRecommendations/);
    assert.doesNotMatch(page, /verificad[oa] por ETNARA|certificad[oa] por ETNARA/i);
  }
  assert.match(shiftsPage, /selfAssignShift\(organizationId, shift\.id, token\)/);
  assert.match(homePage, /ETNARA Care no verifica ni certifica documentos\./);
});

test("Configuración y Mensajes: sin equipo, establecimientos ni «Escribir a mi agencia» en «Mi práctica»", () => {
  assert.match(settings, /if \(!organizationId \|\| !token \|\| independent\) return;/);
  assert.match(settings, /\{!independent && <>\n    \{isOrgAdmin && organizationId && <TeamPanel/);
  assert.match(caregiver, /isIndependentOrganization\(activeOrganization\) \? <RealMessagingPanel recipients=\{recipients\} directTitle="agency" \/> :/);
});

// «Crear turno» deshabilitado (26-nov-2026): mensaje explicativo, sin cambiar las reglas de elegibilidad.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const load = async (path) => {
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
};
const page = read("src/pages/agency/AgencyShiftsPage.tsx");

test("motivo: sin personal, requisitos sin configurar o personal no apto; nada si hay alguien apto", async () => {
  const { noEligibleStaffReason } = await load("src/features/shifts/noEligibleStaff.ts");
  const w = (eligibility) => ({ compliance: { eligibility } });
  assert.equal(noEligibleStaffReason([]), "noStaff");
  assert.equal(noEligibleStaffReason([w("unconfigured"), w("unconfigured")]), "unconfigured");
  assert.equal(noEligibleStaffReason([w("unconfigured"), w("ineligible")]), "notEligible");
  assert.equal(noEligibleStaffReason([w("ineligible"), w("expired"), w("pending_review")]), "notEligible");
  assert.equal(noEligibleStaffReason([w("ineligible"), w("eligible")]), null);
});

test("las reglas no cambian: el botón sigue deshabilitado exactamente igual que antes", () => {
  assert.match(page, /onClick=\{openCreate\} disabled=\{eligibleWorkers\.length === 0\}>Crear turno<\/Button>/);
  assert.match(page, /const eligibleWorkers = useMemo\(\(\) => workers\.filter\(\(worker\) => worker\.compliance\.eligibility === "eligible"\), \[workers\]\);/);
  assert.doesNotMatch(read("src/features/shifts/noEligibleStaff.ts"), /apiClient|fetch\(|getToken/);
});

test("el aviso aparece junto al botón, con enlace a Personal o a Cumplimiento, en agencias y hogares", () => {
  const header = page.indexOf('<PageHeader title="Turnos"');
  const notice = page.indexOf('data-testid="shifts-no-eligible-staff"');
  assert.ok(header > 0 && notice > header && notice - header < 600, "justo debajo del encabezado");
  assert.match(page, /\{noEligibleReason && \(/);
  assert.match(page, /noEligibleReason === "noStaff" \? "\/agency\/workers" : noEligibleReason === "unconfigured" \? COMPLIANCE_POLICIES_PATH : "\/agency\/compliance"/);
  assert.match(page, /t\(`shifts\.noEligible\.\$\{noEligibleReason\}`\)/);
  assert.doesNotMatch(page, /isResidentialOrganization/, "mismo aviso para agencias y hogares");
});

test("textos en español e inglés", () => {
  const es = JSON.parse(read("src/i18n/locales/es/common.json")).shifts.noEligible;
  const en = JSON.parse(read("src/i18n/locales/en/common.json")).shifts.noEligible;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
  assert.match(es.unconfigured, /Cumplimiento/);
  assert.match(en.notEligible, /Compliance/);
  assert.doesNotMatch(JSON.stringify(en), /Cumplimiento|personal|turnos/);
});

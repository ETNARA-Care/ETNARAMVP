// 161 (PR C, 23-nov-2026): documentos autodeclarados, confirmación expresa e «Informe del proveedor».
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
globalThis.__sent = [];
const sent = globalThis.__sent;
const practice = await load("src/api/practice.ts", "const apiClient = { get: async () => ({}), post: async (p, b) => { globalThis.__sent.push([p, b]); return {}; }, patch: async () => ({}), put: async (p, b) => { globalThis.__sent.push([p, b]); return {}; } };");
const selfAssign = await load("src/features/practice/selfAssign.ts", "const apiClient = { post: async (p, b) => { globalThis.__body = b; return { assignment: { id: 'a' } }; } };");
const docsPage = read("src/pages/agency/practice/PracticeDocumentsPage.tsx");
const shiftsPage = read("src/pages/agency/practice/PracticeShiftsPage.tsx");
const panel = read("src/features/shiftReports/ShiftReportPanel.tsx");
const familyView = read("src/features/shiftReports/FamilyShiftReportView.tsx");
const familyPage = read("src/pages/family/FamilyShiftReportsPage.tsx");
const badge = read("src/pages/agency/WorkerCredentialBadge.tsx");

test("estados de documentos del independiente: Registrado, Vence pronto, Vencido, Falta (y Retirado); nunca Verificado ni Aprobado", () => {
  assert.deepEqual(Object.values(practice.PRACTICE_STATUS_LABEL), ["Registrado", "Vence pronto", "Vencido", "Falta", "Retirado"]);
  for (const src of [docsPage, read("src/api/practice.ts")]) assert.doesNotMatch(src.replace(/no verifica, aprueba ni certifica/g, ""), /Verificad|Aprobad|Certificad/);
  assert.match(docsPage, /Autodeclarado/);
  assert.match(docsPage, /ETNARA Care no verifica, aprueba ni certifica documentos\./);
});

test("registrar, corregir, renovar y retirar usan la API de la práctica", async () => {
  await practice.practiceApi.register("o", { credentialTypeCode: "CPR" }, "t");
  await practice.practiceApi.saveRequirements("o", ["CPR"], "t");
  assert.deepEqual(sent[0], ["/organizations/o/practice/documents", { credentialTypeCode: "CPR" }]);
  assert.deepEqual(sent[1], ["/organizations/o/practice/requirements", { credentialTypeCodes: ["CPR"] }]);
  assert.match(docsPage, /open\("renew", d\)/);
  assert.match(docsPage, /practiceApi\.update\(organizationId, doc\.id, \{ retire: true \}, token\)/);
  assert.match(docsPage, /if \(!isIndependentOrganization\(activeOrganization\)\) return <Navigate to="\/agency" replace \/>/);
});

test("la confirmación es expresa (casilla) y solo entonces se envía confirmSelfDeclaration; texto legal fijo", async () => {
  await selfAssign.selfAssignShift("o", "s", "t");
  assert.deepEqual(globalThis.__body, {});
  await selfAssign.selfAssignShift("o", "s", "t", { confirmSelfDeclaration: true });
  assert.deepEqual(globalThis.__body, { confirmSelfDeclaration: true });
  assert.match(shiftsPage, /disabled=\{!confirmChecked\}/);
  assert.match(shiftsPage, /if \(!organizationId \|\| !token \|\| !confirming \|\| !confirmChecked\) return;/);
  assert.equal(selfAssign.SELF_DECLARATION_STATEMENT, "Confirmo que cumplo los requisitos de este servicio.");
  assert.match(shiftsPage, /\{SELF_DECLARATION_NOTICE\} Tu confirmación queda registrada\./);
  assert.doesNotMatch(shiftsPage, /autoriza(do|ción) (legal|para trabajar)/i);
});

test("«Informe del proveedor»: el independiente publica el suyo; agencias y hogares siguen con su revisión", () => {
  assert.match(panel, /if \(providerMode\) \{ await shiftReportsApi\.publishAsProvider/);
  assert.match(panel, /ETNARA Care no lo revisa ni lo aprueba\./);
  assert.match(panel, /\{report\.ownVisit\s*\? <p[^>]*data-testid="shift-report-own-visit"/); // la regla de agencias sigue
  assert.match(read("src/pages/agency/AgencyShiftDetailPage.tsx"), /providerMode=\{isIndependentOrganization\(activeOrganization\)\}/);
});

test("la familia lo ve como «del proveedor», nunca como aprobado por la agencia", () => {
  assert.match(familyView, /const provider = report\.publishedByProvider === true;/);
  assert.match(familyView, /Informe del proveedor: lo publicó el propio proveedor/);
  assert.match(familyPage, /report\.publishedByProvider \? "Informe del proveedor" : "Aprobado"/);
  assert.match(familyPage, /independent \? "Informes del proveedor" : "Aprobados por la agencia"/);
});

test("la agencia ve el autodeclarado como pendiente de SU revisión (sin herencia)", () => {
  assert.match(badge, /if \(credential\.declared_by_holder\) return <Badge tone="warning">Registrado por la cuidadora · pendiente de revisión de la agencia<\/Badge>;/);
  assert.ok(badge.indexOf('review === "approved"') < badge.indexOf("declared_by_holder) return"));
});

test("revisión final: adjuntar con el almacenamiento existente y nombre profesional obligatorio para publicar", () => {
  assert.match(docsPage, /import \{ uploadMyCredentialDocument \} from "@\/api\/credentials";/); // mismo flujo seguro que la cuidadora
  assert.match(docsPage, /await uploadMyCredentialDocument\(organizationId, doc\.id, file, token\)/);
  assert.match(docsPage, /accept="application\/pdf,image\/jpeg,image\/png"/);
  assert.doesNotMatch(docsPage, /fetch\(|s3|bucket/i); // ningún sistema de archivos aparte
  assert.match(docsPage, /practiceApi\.saveProfile\(organizationId, value, token\)/);
  assert.match(panel, /providerMode && report\.ownVisit && !report\.content\.caregiver\?\.name\?\.trim\(\)/);
  assert.match(panel, /await practiceApi\.saveProfile\(organizationId, value, token\);\n\s*await shiftReportsApi\.refresh\(organizationId, report\.id, token\);/);
  assert.match(panel, /PROVIDER_NAME_REQUIRED/);
});

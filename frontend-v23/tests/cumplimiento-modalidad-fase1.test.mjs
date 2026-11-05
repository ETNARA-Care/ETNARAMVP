import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

// Fase 1 de «cumplimiento por modalidad» (decisiones aprobadas el 4-nov-2026). Solo portal.
const catalog = read("src/features/compliance/documentCatalog.ts");

function sources(dir = new URL("src/", root).pathname) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("one catalog: the residential lists are written in exactly one file", () => {
  for (const marker of ["Certificación de Bomberos", "Evaluación dental", "Menú certificado", "Licencia del Departamento de la Familia"]) {
    const files = sources().filter((file) => readFileSync(file, "utf8").includes(`"${marker}"`));
    assert.deepEqual(files.map((f) => f.split("/src/")[1]), ["features/compliance/documentCatalog.ts"], marker);
  }
  for (const consumer of ["src/features/residentCompliance.ts", "src/features/agency/useResidentCompliance.ts", "src/pages/agency/ComplianceAttentionPanel.tsx", "src/pages/agency/EstablishmentCompliancePanel.tsx", "src/pages/agency/AgencyComplianceCenterPage.tsx"]) {
    assert.match(read(consumer), /@\/features\/compliance\/documentCatalog/, consumer);
  }
});

test("residential homes keep exactly their current requirements (same names, same order)", () => {
  assert.match(catalog, /RESIDENTIAL_ESTABLISHMENT_DOCUMENTS = \[\s*"Licencia del Departamento de la Familia",\s*"Certificación de Bomberos",\s*"Licencia sanitaria",\s*"Póliza de responsabilidad",\s*"Menú certificado",\s*\] as const;/);
  assert.match(catalog, /RESIDENTIAL_RESIDENT_DOCUMENTS = \[\s*"Expediente de ingreso",\s*"Evaluación médica",\s*"Evaluación dental",\s*"Consentimiento",\s*"Identificación",\s*\] as const;/);
  assert.match(catalog, /normalizeDocumentType = \(value: string\) => value\.trim\(\)\.toLocaleLowerCase\("es-PR"\)/);
});

test("modality rule: home care without establishments gets no residential panels; establishments always do", () => {
  assert.match(catalog, /if \(type === "RESIDENTIAL_CARE_HOME"\) return "residential";/);
  assert.match(catalog, /if \(type === "HOME_CARE_AGENCY"\) return "home_care";/);
  assert.match(catalog, /return activeEstablishments > 0 \|\| modality === "residential";/);
  const overview = read("src/pages/agency/AgencyOverviewPage.tsx");
  assert.match(overview, /showsResidentialCompliance\(organizationModality\(activeOrganization\?\.type\), compliance\.places\.length\)/);
  for (const panel of ["ReadinessPanel", "ExpiringDocuments", "ResidentsPanel"]) assert.match(overview, new RegExp(`<${panel} [^>]*residential=\\{residential\\}`));
  const readiness = read("src/pages/agency/overview/ReadinessPanel.tsx");
  assert.match(readiness, /if \(!residential\) \{[\s\S]*Credenciales del personal según las políticas de tu agencia/);
  assert.doesNotMatch(readiness.slice(readiness.indexOf("if (!residential)"), readiness.indexOf("const lines")).replace(/\/\/.*$/gm, ""), /Documentos faltantes|expedientes|establecimiento/i);
});

test("no message attributes a legal certification or independent validation to ETNARA", () => {
  const all = sources().map((f) => readFileSync(f, "utf8")).join("\n");
  assert.doesNotMatch(all, /ETNARA realiza la validación independiente/);
  assert.doesNotMatch(all, /pendiente de validación por ETNARA/i);
  assert.doesNotMatch(all, /"ETNARA Compliance"|>ETNARA Compliance</);
  assert.match(catalog, /No certifica el cumplimiento legal: cada organización es responsable de sus obligaciones\./);
  assert.match(read("src/pages/agency/EstablishmentCompliancePanel.tsx"), /\{COMPLIANCE_RESPONSIBILITY_NOTICE\}/);
  assert.match(read("src/pages/agency/AgencyComplianceCenterPage.tsx"), /ETNARA no certifica el cumplimiento legal\./);
  assert.match(read("src/components/ResidentComplianceCard.tsx"), /ETNARA no certifica el cumplimiento legal\./);
  assert.match(read("src/pages/family/FamilySupportPages.tsx"), /Credenciales verificadas por la agencia/);
});

test("documents, history and controls are untouched: upload, history, review status, archive, file limits", () => {
  const panel = read("src/pages/agency/EstablishmentCompliancePanel.tsx");
  for (const call of ["uploadEstablishmentDocument(", "listEstablishmentDocumentHistory(", "getEstablishmentDocumentDownload(", "review_status===\"rejected\"", "review_status===\"approved\"", "MAX_FILE_SIZE=10*1024*1024", "ALLOWED_TYPES=new Set([\"application/pdf\",\"image/jpeg\",\"image/png\"])"]) {
    assert.ok(panel.includes(call), call);
  }
  const api = read("src/api/establishmentDocuments.ts");
  assert.match(api, /archiveEstablishmentDocument/);
  assert.match(api, /documents-history/);
  assert.match(read("src/api/residentDocuments.ts"), /uploadResidentDocument/);
});

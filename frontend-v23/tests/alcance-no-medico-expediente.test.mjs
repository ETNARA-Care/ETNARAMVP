// Alcance no médico (14-nov-2026): el expediente del residente en ETNARA es administrativo.
// No se borran documentos ya cargados: solo deja de pedirse y ofrecerse subir evaluaciones médicas.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("el expediente requerido ya no pide evaluación médica ni dental", () => {
  const catalog = read("src/features/compliance/documentCatalog.ts");
  const list = catalog.match(/RESIDENTIAL_RESIDENT_DOCUMENTS = \[([\s\S]*?)\] as const;/)[1];
  assert.doesNotMatch(list, /Evaluación médica|Evaluación dental/);
  assert.match(list, /"Expediente de ingreso",\s*"Consentimiento",\s*"Identificación"/);
  assert.match(catalog, /Los documentos ya cargados con\s*\n?\s*\*?\s*esos nombres se conservan/);
});

test("al subir un documento no se ofrecen evaluaciones médicas y se avisa", () => {
  const page = read("src/pages/caregiver/EstablishmentResidentProfilePage.tsx");
  assert.doesNotMatch(page, /<option>Evaluación (médica|dental)<\/option>/);
  assert.match(page, /hint=\{RESIDENT_DOCUMENT_NON_MEDICAL_HINT\}/);
  assert.match(read("src/features/compliance/documentCatalog.ts"), /No subas evaluaciones médicas, recetas ni documentos clínicos/);
});

test("los documentos ya cargados se siguen listando sin filtro por tipo", () => {
  const page = read("src/pages/caregiver/EstablishmentResidentProfilePage.tsx");
  assert.match(page, /setDocuments\(v=>\[x\.document,\.\.\.v\]\)/);
  assert.doesNotMatch(page, /documents\.filter\([^)]*Evaluación/);
});

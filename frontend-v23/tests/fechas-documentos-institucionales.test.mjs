// D4 (5-nov-2026): fechas de emisión y vencimiento de documentos institucionales.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const x = await import(new URL("../src/features/compliance/documentExpiry.ts", import.meta.url));
const NOW = new Date(2026, 10, 5, 12, 0, 0); // 5-nov-2026, hora local

test("three different situations: dated, no expiry applicable, not informed", () => {
  const d = (expires_on, expiry_status) => ({ expires_on, expiry_status });
  assert.equal(x.expiryState(d(null, "not_informed"), NOW), "not_informed");
  assert.equal(x.expiryState(d(null), NOW), "not_informed"); // documento anterior a 150
  assert.equal(x.expiryState(d(null, "not_applicable"), NOW), "no_expiry");
  assert.equal(x.expiryState({ expires_on: null, expiry_not_applicable: true }, NOW), "no_expiry");
  assert.equal(x.expiryState(d("2026-11-04", "date"), NOW), "expired");
  assert.equal(x.expiryState(d("2026-11-05", "date"), NOW), "expiring"); // vence al terminar el día
  assert.equal(x.expiryState(d("2026-12-04", "date"), NOW), "expiring"); // dentro de 30 días
  assert.equal(x.expiryState(d("2026-12-06", "date"), NOW), "current");
  assert.equal(x.expiryText(d(null, "not_informed"), NOW), "Vencimiento no informado");
  assert.equal(x.expiryText(d(null, "not_applicable"), NOW), "Sin vencimiento aplicable");
  assert.match(x.expiryText(d("2026-11-01", "date"), NOW), /^Venció /);
});

test("portal validation mirrors the backend; payload for «no aplica» and «no informado»", () => {
  assert.equal(x.validateDocumentDates("", "date", "2027-01-15", NOW), null);
  assert.equal(x.validateDocumentDates("2026-01-15", "date", "2026-01-14", NOW), "El vencimiento no puede ser anterior a la emisión.");
  assert.equal(x.validateDocumentDates("2026-11-06", "none", "", NOW), "La fecha de emisión no puede ser futura.");
  assert.equal(x.validateDocumentDates("", "date", "", NOW), "Indica la fecha de vencimiento o elige otra opción.");
  assert.equal(x.validateDocumentDates("", "unknown", "", NOW), null);
  assert.equal(x.expiresOnPayload("none", ""), "none");
  assert.equal(x.expiresOnPayload("unknown", "2027-01-01"), null);
  assert.equal(x.expiresOnPayload("date", "2027-01-01"), "2027-01-01");
  assert.equal(x.expiryChoiceOf({ expires_on: null, expiry_status: "not_informed" }), "unknown");
  assert.equal(x.expiryChoiceOf({ expires_on: null, expiry_status: "not_applicable" }), "none");
  assert.equal(x.expiryChoiceOf({ expires_on: "2027-01-01", expiry_status: "date" }), "date");
  // 150: sin fechas artificiales en el portal
  for (const f of ["src/features/compliance/documentExpiry.ts", "src/pages/agency/EstablishmentCompliancePanel.tsx", "src/pages/agency/ComplianceAttentionPanel.tsx"]) assert.doesNotMatch(read(f), /9999/, f);
});

test("panel: dates on upload/replace, «Editar fechas» without re-upload, never «al día» without a date", () => {
  const panel = read("src/pages/agency/EstablishmentCompliancePanel.tsx");
  assert.match(panel, /type Status="Faltante"\|"Cargado"\|"Vencimiento no informado"\|"Vencido"\|"Próximo a vencer"/);
  assert.match(panel, /s==="not_informed"\?"Vencimiento no informado"/);
  assert.match(panel, /uploadEstablishmentDocument\(o,selected,t,file,\{documentType:req,title:req,issuedOn:dates\.issuedOn\|\|undefined,expiresOn:expiresOn\?\?undefined\}\)/);
  assert.match(panel, /correctEstablishmentDocumentDates\(o,selected,editing\.id,t,/);
  assert.match(panel, />Editar fechas</);
  assert.match(panel, /Se conserva el mismo archivo/);
  assert.match(panel, /d\.dates_corrected\?"fechas corregidas":"cargada"/);
  assert.match(panel, /label="Fecha de emisión" type="date"/);
  assert.match(panel, /label="Fecha de vencimiento" type="date"/);
  assert.doesNotMatch(panel, /ETNARA (aprueba|revisa|valida)/);
  const api = read("src/api/establishmentDocuments.ts");
  assert.match(api, /apiClient\.post\(`\$\{base\(o,e\)\}\/\$\{d\}\/dates`,dates,t\)/);
});

test("«Requiere atención»: undated institutional documents are a pending item, «no aplica» is fine", () => {
  const panel = read("src/pages/agency/ComplianceAttentionPanel.tsx");
  assert.match(panel, /kind:"Vencido"\|"Próximo a vencer"\|"Vencimiento no informado"\|"Faltante"/);
  assert.match(panel, /const s=expiryState\(d\);/);
  assert.match(panel, /s==="not_informed"\?"Vencimiento no informado" as const/);
  assert.match(panel, /label="Sin fecha informada"/);
  assert.match(panel, /grid grid-cols-2 gap-2 sm:grid-cols-4/);
});

test("an expired institutional document is listed once (Vencido), not also as Faltante", () => {
  const panel = read("src/pages/agency/ComplianceAttentionPanel.tsx");
  assert.match(panel, /const have=new Set\(ed\.map\(d=>norm\(d\.document_type\)\)\);/);
});

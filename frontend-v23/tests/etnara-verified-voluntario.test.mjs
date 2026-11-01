// ETNARA Verified voluntario (1-nov-2026): el portal ya no promete una validación automática de ETNARA,
// distingue «cargado por la agencia» de «verificado por ETNARA» y Central no tiene cola de documentos.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { documentStatus, etnaraVerification, STATUS_TONE, verificationHistoryLabel, AGENCY_DOCUMENTS_NOTICE } from "../src/pages/agency/establishmentDocumentStatus.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const now = new Date("2026-11-01T12:00:00");
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });

test("estado del documento: solo agencia y fecha; nunca «pendiente»", () => {
  assert.equal(documentStatus(undefined, now), "Faltante");
  assert.equal(documentStatus({ expires_on: null, review_status: "pending" }, now), "Cargado");
  assert.equal(documentStatus({ expires_on: "2027-06-30", review_status: "pending" }, now), "Cargado");
  assert.equal(documentStatus({ expires_on: "2026-11-20", review_status: "pending" }, now), "Próximo a vencer");
  assert.equal(documentStatus({ expires_on: "2026-10-31", review_status: "approved" }, now), "Vencido");
  // Antes «Rechazado» tapaba la fecha; ahora la verificación no cambia el estado del documento.
  assert.equal(documentStatus({ expires_on: "2027-06-30", review_status: "rejected" }, now), "Cargado");
  assert.equal(documentStatus({ expires_on: "2026-11-01", review_status: "pending" }, now), "Próximo a vencer");
  assert.deepEqual(Object.keys(STATUS_TONE).sort(), ["Cargado", "Faltante", "Próximo a vencer", "Vencido"].sort());
});

test("verificación de ETNARA: aparte, solo cuando existe", () => {
  assert.equal(etnaraVerification({ expires_on: null, review_status: "pending" }), null);
  assert.equal(etnaraVerification(undefined), null);
  assert.deepEqual(etnaraVerification({ expires_on: null, review_status: "approved", reviewed_at: "2026-10-20T10:00:00Z" }),
    { label: "Verificado por ETNARA", tone: "success", at: "2026-10-20T10:00:00Z", reason: null });
  assert.equal(etnaraVerification({ expires_on: null, review_status: "rejected", review_reason: "Ilegible" }).reason, "Ilegible");
  assert.equal(verificationHistoryLabel({ expires_on: null, review_status: "pending" }), "Sin verificación de ETNARA");
  assert.match(AGENCY_DOCUMENTS_NOTICE, /ETNARA no tiene acceso a ellos ni los valida automáticamente/);
  assert.match(AGENCY_DOCUMENTS_NOTICE, /voluntaria/);
});

test("ninguna pantalla promete validación automática ni deja documentos «pendientes de validación»", () => {
  for (const f of files(new URL("../src", import.meta.url).pathname).filter((f) => /\.(tsx?|json)$/.test(f))) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /ETNARA realiza la validación independiente|pendiente de validación por ETNARA|Pendiente de validación/i, f);
    assert.doesNotMatch(s, /establishment-documents\/verification-queue|\/platform\/establishment-documents/, f);
  }
});

test("la agencia conserva cargar, ver, reemplazar e historial de sus documentos", () => {
  const panel = read("src/pages/agency/EstablishmentCompliancePanel.tsx");
  for (const fn of ["listEstablishmentDocuments", "uploadEstablishmentDocument", "getEstablishmentDocumentDownload", "listEstablishmentDocumentHistory"]) assert.match(panel, new RegExp(fn));
  assert.match(panel, /Escoger reemplazo/);
  assert.match(panel, /toast\.show\("Documento cargado\.","success"\)/);
  assert.match(panel, /documentStatus\(doc,now\)/);
  assert.match(panel, /x\.verification&&<Badge tone=\{x\.verification\.tone\}>/);
  assert.doesNotMatch(panel, /review_status==="approved"\)status=|"Vigente"/);
  const api = read("src/api/establishmentDocuments.ts");
  assert.doesNotMatch(api, /reviewEstablishmentDocument|\/review/);
});

test("Central: sin cola, sin consultas de documentos; Tower sin consulta documental", () => {
  assert.equal(existsSync(new URL("../src/api/platformCredentials.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../src/features/tower/TowerCompliancePanel.tsx", import.meta.url)), false);
  const overview = read("src/pages/platform/PlatformOverviewPage.tsx");
  assert.doesNotMatch(overview, /pendingDocuments|Documentos de establecimiento pendientes|Abrir verificación/);
  assert.match(overview, /Sin verificaciones autorizadas/);
  assert.doesNotMatch(read("src/pages/platform/PlatformTowerPage.tsx"), /TowerCompliancePanel/);
  const es = JSON.parse(read("src/i18n/locales/es/shell.json")), en = JSON.parse(read("src/i18n/locales/en/shell.json"));
  const find = (o, k) => JSON.stringify(o).match(new RegExp(`"${k}":"([^"]+)"`))?.[1];
  assert.equal(find(es, "verification"), "ETNARA Verified"); assert.equal(find(es, "verificationShort"), "Verified");
  assert.equal(find(en, "verification"), "ETNARA Verified");
});

// Contrato Oficial v1.1 (156): Word original descargable y términos individuales por función.
// No bloquea nada; con el módulo apagado el servidor responde 404 y no se muestra.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("la agencia descarga el Word original aprobado, con su huella, si ETNARA lo guardó", () => {
  const api = read("src/api/contracts.ts");
  assert.match(api, /sourceFile\?: \{ fileName: string; byteSize: number; sha256: string \} \| null/);
  assert.match(api, /format: "pdf" \| "txt" \| "docx"/);
  const page = read("src/pages/agency/AgencyContractDetailPage.tsx");
  assert.match(page, /\{v\.sourceFile && <Button[^]*?data-testid="download-docx">Word original \(\.docx\)<\/Button>\}/);
  assert.match(page, /data-testid="source-file-hash"/);
});

test("términos por función: API propia, casilla desmarcada, PDF y aceptación con la huella vista", () => {
  const api = read("src/api/contracts.ts");
  assert.match(api, /\/organizations\/\$\{o\}\/role-terms/);
  assert.match(api, /\{ contentSha256, confirm: true \}/);
  const gate = read("src/features/contracts/RoleTermsGate.tsx");
  assert.match(gate, /useState\(false\)/);
  assert.match(gate, /disabled=\{!checked\}/);
  assert.match(gate, /roleTermsApi\.accept\(organizationId, pending\.id, token, pending\.content_sha256\)/);
  assert.match(gate, /data-testid="role-terms-pdf"/);
});

test("no bloquea: se puede dejar para más tarde y no se muestra si el servidor no lo ofrece", () => {
  const gate = read("src/features/contracts/RoleTermsGate.tsx");
  assert.match(gate, /onClose=\{\(\) => setLater\(true\)\}/);
  assert.match(gate, /data-testid="role-terms-later"/);
  assert.match(gate, /\.catch\(\(\) => setData\(null\)\)/);
  assert.doesNotMatch(gate, /Navigate|navigate\(/);
});

test("aparece en los portales de administración, cuidador y familia", () => {
  for (const f of ["src/layouts/AgencyLayout.tsx", "src/layouts/CaregiverLayout.tsx", "src/layouts/FamilyLayout.tsx"]) {
    assert.match(read(f), /<RoleTermsGate organizationId=\{activeOrganization\?\.id\} \/>/, f);
  }
});

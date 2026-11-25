import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const load = async (path) => {
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
};

// 24-nov-2026 (regla Care ↔ Connect): Care no verifica credenciales; los textos atribuyen la aprobación a la agencia.
test("«Aprobada por tu agencia» solo con revisión aprobada de la agencia en todas las credenciales y ninguna vencida", async () => {
  const m = await load("src/features/caregiver/credentialApproval.ts");
  const ok = { status: "active", verificationStatus: "verified" };
  assert.equal(m.AGENCY_APPROVAL_LABEL, "Aprobada por tu agencia");
  assert.equal(m.showAgencyApproval(null), false);
  assert.equal(m.showAgencyApproval([]), false);
  assert.equal(m.showAgencyApproval([ok]), true);
  assert.equal(m.showAgencyApproval([ok, ok]), true);
  assert.equal(m.showAgencyApproval([ok, { status: "active", verificationStatus: "pending" }]), false, "una sin revisión");
  assert.equal(m.showAgencyApproval([ok, { status: "active", verificationStatus: "rejected" }]), false, "una rechazada");
  assert.equal(m.showAgencyApproval([{ status: "expired", verificationStatus: "verified" }]), false, "vencida");
});

test("los textos ya no dicen «Verificada» ni «requisitos verificados»", () => {
  const page = read("src/pages/caregiver/CaregiverSupportPages.tsx");
  const sm = read("src/features/smartmatch/smartmatchText.ts");
  assert.doesNotMatch(page, />Verificada</);
  assert.match(page, /\{showAgencyApproval\(credentials\) && <Badge tone="success">\{AGENCY_APPROVAL_LABEL\}<\/Badge>\}/);
  assert.match(sm, /APPROVED_ELIGIBLE: "Cumple todos los requisitos revisados por la agencia"/);
  assert.doesNotMatch(sm, /requisitos verificados/);
});

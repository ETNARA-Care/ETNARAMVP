// Módulo contractual, Etapa 2 (9-nov-2026): pantallas de contrato y aceptación electrónica.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const f = await import(new URL("../src/features/contracts/contractFormat.ts", import.meta.url));
const detail = read("src/pages/agency/AgencyContractDetailPage.tsx");
const list = read("src/pages/agency/AgencyContractsPage.tsx");
const central = read("src/pages/platform/PlatformContractsPage.tsx");
const api = read("src/api/contracts.ts");
const layout = read("src/layouts/AgencyLayout.tsx");
const app = read("src/App.tsx");

test("validación del formulario igual que el servidor: nombre y apellido, cargo, código de 6 dígitos", () => {
  assert.equal(f.validFullName("Ana"), false);
  assert.equal(f.validFullName("  Ana Prueba  "), true);
  assert.equal(f.validTitle(" "), false);
  assert.equal(f.validTitle("Presidenta"), true);
  assert.equal(f.validCode("12345"), false);
  assert.equal(f.validCode("123456"), true);
  assert.equal(f.validCode("12a456"), false);
});

test("estados con el mismo vocabulario para la agencia y Central", () => {
  assert.equal(f.acceptanceLabel("accepted").label, "Aceptado");
  assert.equal(f.acceptanceLabel("pending").label, "Pendiente de aceptación");
  assert.equal(f.acceptanceLabel("pending", true).label, "Nueva versión: requiere aceptación");
  assert.equal(f.acceptanceLabel("covered").label, "Vigente por aceptación anterior");
});

test("casillas desmarcadas por defecto y el código solo se pide con el formulario completo", () => {
  assert.match(detail, /const \[readAndAccept, setReadAndAccept\] = useState\(false\)/);
  assert.match(detail, /const \[authority, setAuthority\] = useState\(false\)/);
  assert.match(detail, /formValid = validFullName\(fullName\) && validTitle\(title\) && readAndAccept && authority/);
  assert.match(detail, /data-testid="request-code"[\s\S]{0,40}|disabled=\{!formValid\}/);
  // La declaración de autoridad es la del servidor, no un texto del portal.
  assert.match(detail, /label=\{v\.authorityDeclaration\}/);
  // Código de un solo uso con teclado numérico y autocompletado del sistema.
  assert.match(detail, /autoComplete="one-time-code"/);
  assert.match(detail, /inputMode="numeric"/);
});

test("descarga antes de aceptar (PDF y texto exacto) y constancia, siempre con la sesión", () => {
  assert.match(detail, /download\("pdf"\)/);
  assert.match(detail, /download\("txt"\)/);
  assert.match(detail, /download-certificate/);
  assert.match(list, /history-certificate/);
  assert.match(api, /apiClient\.getBinary\(`\$\{base\(o\)\}\/acceptances\/\$\{a\}\/certificate\.pdf`/);
  assert.doesNotMatch(api, /window\.open/);
});

test("solo la administración: supervisión, cuidadores y familiares no ven el formulario", () => {
  for (const page of [detail, list]) {
    assert.match(page, /isAdmin = roles\.includes\("ORGANIZATION_ADMIN"\)/);
    assert.match(page, /contracts-not-authorized/);
  }
  assert.match(layout, /useContractsAvailable\(activeOrganization\?\.id, roles\.includes\("ORGANIZATION_ADMIN"\)\)/);
  assert.match(layout, /contracts\.available \|\| item\.to !== "\/agency\/contracts"/);
});

test("Central solo consulta: sin botón de aceptar ni llamadas de firma", () => {
  assert.doesNotMatch(central, /accept\(|requestCode|signature-code|Firmar/);
  assert.match(central, /centralOverview/);
  assert.match(app, /<Route path="contracts" element=\{<PlatformContractsPage\/>\}\/>/);
});

test("versiones: aviso de versión nueva y el historial conserva las aceptaciones anteriores", () => {
  assert.match(list, /contracts-new-version-notice/);
  assert.match(list, /tus aceptaciones anteriores se conservan en el historial/);
  assert.match(list, /versión reemplazada/);
});

test("sin bloqueos: con el módulo apagado (404) no aparece en el menú y la pantalla lo explica", () => {
  assert.match(read("src/features/contracts/useContractsAvailable.ts"), /catch\(\(\) => \{ if \(!cancelled\) setState\(\{ available: false, pending: 0, status: null \}\)/);
  assert.match(list, /Contratos no disponibles/);
  assert.doesNotMatch(app, /ContractGate|RequireContract/);
});

// ---- 153: contrato SaaS v1.0 (9-nov-2026, local)
const hook = read("src/features/contracts/useContractsAvailable.ts");
test("153: textos de las casillas del servidor, representante no designada sin formulario, Orden informativa", () => {
  assert.match(detail, /label=\{v\.acceptanceCheckboxText \?\?/);
  assert.match(detail, /data-testid="signer-not-designated"/);
  assert.match(detail, /Administrar la plataforma no equivale, por sí solo, a tener autoridad legal/);
  assert.match(detail, /Aceptar esta Orden no activa ningún cobro/);
  assert.match(api, /CONTRACT_SIGNATORY_NOT_DESIGNATED/);
  assert.match(api, /CONTRACT_ACCEPTANCE_REQUIRED/);
  const none = f.orderTermsLines({ planName: "Plan A", features: ["Turnos"], pricing: { proposedMonthlyPriceUsd: null }, chargesRequireExpressAcceptance: true, billingActivated: false });
  assert.ok(none.includes("Precio mensual: por definir y aceptar."));
  assert.ok(!none.join(" ").includes("99"));
  const priced = f.orderTermsLines({ planName: "Plan B", pricing: { proposedMonthlyPriceUsd: 135.5 }, foundingProgram: { proposedBenefits: [] } });
  assert.ok(priced.some((l) => l.includes("US$135.50 (sujeto a aprobación y a tu aceptación expresa)")));
  assert.ok(priced.some((l) => l.includes("pendiente de aprobación definitiva")));
  assert.match(detail, /data-testid="test-document-not-signable"/);
  assert.match(api, /CONTRACT_TEST_DOCUMENT_NOT_SIGNABLE/);
});
test("153: la redirección a Contratos solo ocurre si el servidor declara «solo contrato» activo", async () => {
  assert.match(layout, /contractOnlyRedirect\(contracts\.status, location\.pathname\)/);
  assert.match(hook, /status\.serverEnforcementEnabled && status\.restricted && status\.mode === "contract_only"/);
  const st = (o) => ({ serverEnforcementEnabled: true, restricted: true, mode: "contract_only", satisfied: false, pendingRequired: 1, notice: true, enforceFrom: null, ...o });
  const decide = (s, p) => !!s && s.serverEnforcementEnabled && s.restricted && s.mode === "contract_only" && !p.startsWith("/agency/contracts");
  assert.equal(decide(st({ serverEnforcementEnabled: false, restricted: false }), "/agency"), false);
  assert.equal(decide(st({ mode: "restrict_new_operations" }), "/agency"), false);
  assert.equal(decide(st({}), "/agency/contracts/x"), false);
  assert.equal(decide(st({}), "/agency/shifts"), true);
  assert.equal(decide(null, "/agency"), false);
});

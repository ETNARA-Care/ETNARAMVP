// 170 (hogares F0, 24-nov-2026): menú base del hogar, módulos denegados y franja de demostración.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const centralEs = readFileSync(new URL("../src/i18n/locales/es/central.json", import.meta.url), "utf8"); // F0.1: textos de Central en el catálogo

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
async function load(path) {
  const src = read(path).replace(/^import [^;]+;$/gm, "");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}
const residential = await load("src/features/residential/modality.ts");
const practice = await load("src/features/practice/modality.ts");
const layout = read("src/layouts/AgencyLayout.tsx");
const app = read("src/App.tsx");
const panel = read("src/pages/agency/residential/ResidentialPanelPage.tsx");
const banner = read("src/components/DemoEnvironmentBanner.tsx");

test("solo RESIDENTIAL_CARE_HOME es hogar; agencias e independientes no", () => {
  assert.equal(residential.isResidentialOrganization({ type: "RESIDENTIAL_CARE_HOME" }), true);
  for (const type of ["HOME_CARE_AGENCY", "INDEPENDENT_PROVIDER", undefined, null]) assert.equal(residential.isResidentialOrganization({ type }), false);
  assert.equal(residential.isResidentialOrganization(null), false);
  // Las tres modalidades son excluyentes.
  for (const type of ["HOME_CARE_AGENCY", "RESIDENTIAL_CARE_HOME", "INDEPENDENT_PROVIDER"])
    assert.ok(!(residential.isResidentialOrganization({ type }) && practice.isIndependentOrganization({ type })), type);
});

test("en un hogar se ocultan SmartMatch, Finanzas/Facturación e Informe de Turno (con subrutas); el resto sigue", () => {
  for (const p of ["/agency/smartmatch", "/agency/finance", "/agency/finance/x", "/agency/shift-reports", "/AGENCY/SMARTMATCH/"])
    assert.equal(residential.isHiddenForResidential(p), true, p);
  for (const p of ["/agency", "/agency/hogar", "/agency/residents", "/agency/workers", "/agency/shifts", "/agency/timesheets", "/agency/contracts", "/agency/settings", "/agency/compliance", "/agency/financex"])
    assert.equal(residential.isHiddenForResidential(p), false, p);
});

test("el menú, la redirección y el grupo «Hogar» se aplican solo al hogar; agencia e independiente sin cambios", () => {
  assert.match(layout, /\(residential \? RESIDENTIAL_GROUPS : \(independent \? PRACTICE_GROUPS : GROUPS\)\)/);
  assert.match(layout, /\(!residential \|\| !isHiddenForResidential\(item\.to\)\) &&/);
  assert.match(layout, /residential && isHiddenForResidential\(location\.pathname\) \? <Navigate to="\/agency" replace \/>/);
  assert.match(layout, /independent && isHiddenForIndependent\(location\.pathname\) \? <Navigate to="\/agency" replace \/>/);
  assert.match(layout, /\(independent \? PRACTICE_MOBILE_TABS : MOBILE_TABS\)/);
  const groups = layout.slice(layout.indexOf("const GROUPS:"), layout.indexOf("/* 160 (PR B)"));
  assert.doesNotMatch(groups, /residential|hogar/i);
  const res = layout.slice(layout.indexOf("const RESIDENTIAL:"), layout.indexOf("const RESIDENTIAL_GROUPS"));
  assert.match(res, /RESIDENTIAL_PANEL_PATH/);
  assert.equal(residential.RESIDENTIAL_PANEL_PATH, "/agency/hogar");
});

test("panel base: solo hogares, solo recuentos y estado de módulos; sin datos clínicos ni nombres", () => {
  assert.match(app, /<Route path="hogar" element=\{<ResidentialPanelPage\/>\}\/>/);
  assert.match(panel, /if \(!residential\) return <Navigate to="\/agency" replace \/>/);
  assert.match(panel, /getResidentialOverview/);
  assert.doesNotMatch(panel, /diagn|medic|clínic|first_name|last_name/i);
  assert.match(read("src/i18n/locales/es/residential.json"), /Nada se bloquea/); // F0.1: texto en el catálogo
});

test("franja de demostración: solo con DEMO_ENVIRONMENT, en los tres portales de la organización", () => {
  assert.equal(residential.isDemoEnvironment(["DEMO_ENVIRONMENT"]), true);
  for (const f of [[], ["SMARTMATCH"], null, undefined]) assert.equal(residential.isDemoEnvironment(f), false);
  assert.equal(residential.DEMO_ENVIRONMENT_NOTICE, "Entorno de demostración — Datos ficticios");
  assert.match(banner, /if \(!isDemoEnvironment\(activeOrganization\?\.features\)\) return null;/);
  for (const l of ["AgencyLayout", "CaregiverLayout", "FamilyLayout"]) assert.match(read(`src/layouts/${l}.tsx`), /<DemoEnvironmentBanner \/>/, l);
});

test("ETNARA Central muestra los interruptores de hogar (apagados por defecto; mostrar no activa)", () => {
  const card = read("src/features/platform/OrganizationFeaturesCard.tsx");
  const api = read("src/api/platformOrganizations.ts");
  assert.match(api, /export type ResidentialFeatureCode = "HOGAR_CALENDARIO" \| "HOGAR_ASIGNACIONES" \| "HOGAR_PONCHES" \| "DEMO_ENVIRONMENT";/);
  assert.match(api, /setOrganizationFeature\(organizationId: string, code: CentralFeatureCode,/);
  for (const code of ["HOGAR_CALENDARIO", "HOGAR_ASIGNACIONES", "HOGAR_PONCHES", "DEMO_ENVIRONMENT"]) assert.match(centralEs, new RegExp(`"${code}": \\{\\s*"title": "`));
  assert.match(card, /data\.features\.filter\(\(f\) => isKnownFeature\(f\.code\)\)/);
  assert.match(card, /FEATURE_NOT_AVAILABLE_FOR_MODALITY/);
  // Sigue habiendo un solo punto de escritura, con motivo obligatorio (mismo flujo que los demás interruptores).
  assert.equal((card.match(/setOrganizationFeature\(/g) ?? []).length, 1);
  assert.match(card, /reason\.trim\(\)\.length < 3/);
});

// Revisión independiente 25-nov (A4): cambio rápido de organización sin datos del hogar anterior.
const latestReq = await load("src/features/residential/latestRequest.ts");
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

/** Reproduce el flujo del panel: cada cambio de organización invalida la carga anterior y empieza otra. */
function simulatePanel() {
  const latest = latestReq.createLatestRequest();
  let state = null; let active = null; const seen = [];
  const record = () => { const v = latestReq.scopedTo(state, active); seen.push({ active, shown: v ? v.organizationId : null }); };
  return {
    switchTo(org, residential, response) {
      latest.invalidate(); active = org; record();
      if (!residential) return Promise.resolve();
      const request = latest.begin();
      return response.then((data) => { if (request.isCurrent()) state = { organizationId: org, data, error: false }; record(); },
        () => { if (request.isCurrent()) state = { organizationId: org, data: null, error: true }; record(); });
    },
    visible: () => latestReq.scopedTo(state, active), seen,
  };
}

test("A4: entre dos hogares, la respuesta atrasada del primero nunca sobrescribe ni se muestra en el segundo", async () => {
  const p = simulatePanel(); const h1 = deferred(), h2 = deferred();
  const a = p.switchTo("H1", true, h1.promise);
  const b = p.switchTo("H2", true, h2.promise);
  h2.resolve({ activeResidents: 2 }); await b;
  h1.resolve({ activeResidents: 9 }); await a;
  assert.equal(p.visible().organizationId, "H2");
  assert.equal(p.visible().data.activeResidents, 2);
  for (const s of p.seen) assert.ok(s.shown === null || s.shown === s.active, JSON.stringify(s));
});

test("A4: cambios muy rápidos H1 → H2 → H1 → H2 y fallos atrasados: solo cuenta la última carga", async () => {
  const p = simulatePanel(); const r = [deferred(), deferred(), deferred(), deferred()];
  const runs = ["H1", "H2", "H1", "H2"].map((o, i) => p.switchTo(o, true, r[i].promise));
  r[3].resolve({ activeResidents: 4 }); r[0].reject(new Error("tarde")); r[2].resolve({ activeResidents: 1 }); r[1].resolve({ activeResidents: 7 });
  await Promise.all(runs);
  assert.deepEqual([p.visible().organizationId, p.visible().data.activeResidents, p.visible().error], ["H2", 4, false]);
  for (const s of p.seen) assert.ok(s.shown === null || s.shown === s.active, JSON.stringify(s));
});

test("A4: entre las tres modalidades, al salir del hogar no queda nada visible y al volver se carga de nuevo", async () => {
  const p = simulatePanel(); const h = deferred(), late = deferred();
  const first = p.switchTo("H1", true, late.promise);
  await p.switchTo("AGENCIA", false); assert.equal(p.visible(), null);
  await p.switchTo("INDEPENDIENTE", false); assert.equal(p.visible(), null);
  late.resolve({ activeResidents: 9 }); await first;
  assert.equal(p.visible(), null, "la respuesta atrasada del hogar no aparece en otra modalidad");
  const back = p.switchTo("H1", true, h.promise); assert.equal(p.visible(), null, "al volver no se reutilizan datos viejos");
  h.resolve({ activeResidents: 3 }); await back;
  assert.equal(p.visible().data.activeResidents, 3);
});

test("A4: el panel usa la carga ligada a la organización (turno, descarte y filtro por organización activa)", () => {
  const src = read("src/pages/agency/residential/ResidentialPanelPage.tsx");
  assert.match(src, /const request = latest\.current\.begin\(\);/);
  assert.match(src, /if \(request\.isCurrent\(\)\) setState\(\{ organizationId, data: overview, error: false \}\)/);
  assert.match(src, /if \(request\.isCurrent\(\)\) setState\(\{ organizationId, data: null, error: true \}\)/);
  assert.match(src, /return \(\) => tracker\.invalidate\(\);/);
  assert.match(src, /const current = scopedTo\(state, organizationId\);/);
  assert.doesNotMatch(src, /setOverview|setError/);
});

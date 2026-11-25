// 170 (hogares F0, 24-nov-2026): menú base del hogar, módulos denegados y franja de demostración.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

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
  assert.match(panel, /Nada se bloquea/);
});

test("franja de demostración: solo con DEMO_ENVIRONMENT, en los tres portales de la organización", () => {
  assert.equal(residential.isDemoEnvironment(["DEMO_ENVIRONMENT"]), true);
  for (const f of [[], ["SMARTMATCH"], null, undefined]) assert.equal(residential.isDemoEnvironment(f), false);
  assert.equal(residential.DEMO_ENVIRONMENT_NOTICE, "Entorno de demostración — Datos ficticios");
  assert.match(banner, /if \(!isDemoEnvironment\(activeOrganization\?\.features\)\) return null;/);
  for (const l of ["AgencyLayout", "CaregiverLayout", "FamilyLayout"]) assert.match(read(`src/layouts/${l}.tsx`), /<DemoEnvironmentBanner \/>/, l);
});

// F6 (hogares, 26-nov-2026): guías de uso imprimibles de los tres portales.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const guide = read("src/features/residential/ResidentialGuide.tsx");
const link = read("src/features/residential/GuideLink.tsx");
const css = read("src/styles/tokens.css");
const layout = read("src/layouts/AgencyLayout.tsx");
const es = JSON.parse(read("src/i18n/locales/es/residential.json")).guides, en = JSON.parse(read("src/i18n/locales/en/residential.json")).guides;
const esS = JSON.parse(read("src/i18n/locales/es/shell.json")), enS = JSON.parse(read("src/i18n/locales/en/shell.json"));
const shape = (g) => ({ title: !!g.title, intro: !!g.intro, privacy: !!g.privacy, sections: g.sections.map((s) => [!!s.title, s.steps.length]) });

test("F6: tres guías con su ruta en su portal, solo para hogares", () => {
  assert.match(app, /<Route path="hogar\/guia" element=\{<ResidentialGuide audience="admin"\/>\}\/>/);
  assert.match(app, /<Route path="guia" element=\{<ResidentialGuide audience="caregiver"\/>\}\/>/);
  assert.match(app, /<Route path="guia" element=\{<ResidentialGuide audience="family"\/>\}\/>/);
  assert.match(guide, /if \(!residential\) return <Navigate to=\{fallback\[audience\]\} replace \/>;/);
  assert.match(link, /if \(!isResidentialOrganization\(activeOrganization\)\) return null;/);
  assert.match(layout, /\{ to: RESIDENTIAL_ADMIN_GUIDE_PATH, icon: BookOpen, k: "residentialGuide" \}/);
  for (const f of ["src/pages/caregiver/CaregiverSupportPages.tsx", "src/pages/caregiver/CaregiverResidentsPage.tsx", "src/pages/family/FamilySupportPages.tsx", "src/pages/family/ResidentialFamilyPages.tsx", "src/pages/agency/residential/ResidentialPanelPage.tsx"])
    assert.match(read(f), /<GuideLink to=\{(CAREGIVER|FAMILY|RESIDENTIAL_ADMIN)_GUIDE_PATH\}/, f);
});

test("F6: imprimibles — al imprimir solo sale la guía; el botón no se imprime", () => {
  assert.match(css, /body\.etnara-print-guide \*:not\(:has\(\[data-print-guide\]\)\):not\(\[data-print-guide\]\):not\(\[data-print-guide\] \*\) \{ display: none !important; \}/);
  assert.match(css, /body\.etnara-print-guide \*:has\(\[data-print-guide\]\) \{ min-height: 0 !important; height: auto !important;/);
  assert.match(guide, /document\.body\.classList\.add\("etnara-print-guide"\)/);
  assert.match(guide, /return \(\) => document\.body\.classList\.remove\("etnara-print-guide"\)/);
  assert.match(guide, /<div className="print:hidden"><Button/);
});

test("F6: breves y completas en español e inglés, con la misma estructura", () => {
  for (const a of ["admin", "caregiver", "family"]) {
    assert.deepEqual(shape(es[a]), shape(en[a]), a);
    assert.ok(es[a].sections.length <= 6 && es[a].sections.every((s) => s.steps.length <= 3), `${a} breve`);
  }
  for (const k of ["brand", "print", "open", "footer"]) assert.ok(es[k] && en[k], k);
  assert.equal(esS.agency.items.residentialGuide, "Guía de uso");
  assert.equal(enS.agency.items.residentialGuide, "User guide");
});

test("F6: los nombres de menú que citan las guías existen en ese portal y en ese idioma", () => {
  const quoted = (g) => [...JSON.stringify(g).matchAll(/[«“]([^»”]+)[»”]/g)].map((m) => m[1]);
  const menus = (s, portal) => Object.values(s[portal].items);
  for (const [lang, g, s] of [["es", es, esS], ["en", en, enS]]) {
    const resid = JSON.parse(read(`src/i18n/locales/${lang}/residential.json`));
    const extra = [resid.activities.record, resid.assignments.substitution.open];
    for (const q of quoted(g.caregiver)) assert.ok(menus(s, "caregiver").includes(q) || extra.includes(q), `${lang} cuidador «${q}»`);
    for (const q of quoted(g.family)) assert.ok(menus(s, "family").includes(q), `${lang} familia «${q}»`);
    for (const q of quoted(g.admin)) assert.ok(menus(s, "agency").includes(q) || extra.includes(q), `${lang} administración «${q}»`);
  }
});

test("F6: alcance no clínico y privacidad de la familia", () => {
  assert.match(es.footer, /no es un sistema clínico/);
  assert.match(en.footer, /not a clinical system/);
  assert.match(es.family.privacy, /no se comparten/);
  assert.doesNotMatch(JSON.stringify(es.family) + JSON.stringify(en.family), /ponch|punch|turno de|horario del|schedule of|credencial|credential/i);
});

test("F6 (28-nov): las guías siguen a lo integrado — «Mi horario» y «Turnos», presentes confirmados y primer establecimiento", () => {
  const step = (g, a, i, j) => g[a].sections[i].steps[j];
  const all = (g, a) => g[a].sections.flatMap((s) => s.steps).join(" ");
  assert.equal(esS.caregiver.items.mySchedule, "Mi horario");
  assert.equal(enS.caregiver.items.mySchedule, "My schedule");
  assert.match(all(es, "caregiver"), /En «Mi horario» ves tu semana publicada/);
  assert.match(all(es, "caregiver"), /En «Turnos» aceptas o rechazas cada turno/);
  assert.match(all(en, "caregiver"), /In “My schedule” you see your published week/);
  assert.match(all(en, "caregiver"), /In “Shifts” you accept or decline each shift/);
  assert.match(all(es, "admin"), /presente \(entradas confirmadas\)/);
  assert.match(all(en, "admin"), /present \(confirmed entries\)/);
  // El primer paso de un hogar nuevo coincide con lo que dice la pantalla vacía de establecimientos.
  const esR = JSON.parse(read("src/i18n/locales/es/residential.json")), enR = JSON.parse(read("src/i18n/locales/en/residential.json"));
  assert.match(step(es, "admin", 0, 0), /Configuración → Establecimientos/);
  assert.match(esR.establishments.emptyDetail, /Configuración → Establecimientos/);
  assert.match(step(en, "admin", 0, 0), /Settings → Facilities/);
  assert.match(enR.establishments.emptyDetail, /Settings → Facilities/);
});

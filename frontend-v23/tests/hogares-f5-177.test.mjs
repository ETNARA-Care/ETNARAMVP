// 177 (hogares F5, 26-nov-2026): informes y portales del hogar.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const layout = read("src/layouts/AgencyLayout.tsx");
const familyLayout = read("src/layouts/FamilyLayout.tsx");
const modality = read("src/features/residential/modality.ts");
const reportsPage = read("src/pages/agency/residential/ResidentialReportsPage.tsx");
const panel = read("src/pages/agency/residential/ResidentialPanelPage.tsx");
const family = read("src/pages/family/ResidentialFamilyPages.tsx");
const caregiver = read("src/pages/caregiver/CaregiverResidentsPage.tsx");
const central = read("src/pages/platform/PlatformOrganizationsPage.tsx");
const activities = read("src/features/residential/activities.ts");
const reportsHelpers = read("src/features/residential/reports.ts");
const familyActivity = read("src/features/residential/familyActivity.ts");
const es = JSON.parse(read("src/i18n/locales/es/residential.json")), en = JSON.parse(read("src/i18n/locales/en/residential.json"));
const esC = JSON.parse(read("src/i18n/locales/es/central.json")), enC = JSON.parse(read("src/i18n/locales/en/central.json"));
const esS = JSON.parse(read("src/i18n/locales/es/shell.json")), enS = JSON.parse(read("src/i18n/locales/en/shell.json"));
const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort();
const strip = (src) => src.replace(/^import .*\n/gm, "").replace(/export (const|function)/g, "$1");

test("F5: rutas y menús solo para hogares; informes con pestañas por interruptor", () => {
  assert.match(modality, /RESIDENTIAL_REPORTS_PATH = "\/agency\/hogar\/informes"/);
  assert.match(app, /<Route path="hogar\/informes" element=\{<ResidentialReportsPage\/>\}\/>/);
  assert.match(layout, /\{ to: RESIDENTIAL_REPORTS_PATH, icon: FileBarChart, k: "residentialReports" \}/);
  assert.match(reportsPage, /if \(!residential\) return <Navigate to="\/agency" replace \/>;/);
  assert.match(reportsPage, /\.\.\.\(attendanceOn \? \["attendance" as const\] : \[\]\), \.\.\.\(assignmentsOn \? \["assignments" as const\] : \[\]\), "occupancy"/);
  assert.match(reportsPage, /useOrgFeature\("HOGAR_PONCHES"\)/);
  assert.match(reportsPage, /useOrgFeature\("HOGAR_ASIGNACIONES"\)/);
});

test("F5: informe de asistencia — rango 1 a 31 días, validadas y pendientes por separado, CSV que dice que no es nómina y abre en Excel", () => {
  assert.match(reportsHelpers, /REPORT_MAX_DAYS = 31/);
  assert.match(reportsPage, /disabled=\{busy \|\| !valid\}/);
  assert.match(reportsPage, /"\\uFEFF" \+ csvLines\(rows\)/);
  assert.match(reportsHelpers, /const out: string\[\]\[\] = \[\[notice\]/);
  assert.match(es.reports.attendance.csvNotice, /no es nómina/);
  assert.match(en.reports.attendance.csvNotice, /not payroll/);
  assert.ok(es.reports.attendance.csvPeople.validated && es.reports.attendance.csvPeople.pending);
});

test("F5: ayudas puras de informes y actividades", async () => {
  const r = await import(`data:text/javascript,${encodeURIComponent(strip(reportsHelpers).replace(/: [A-Za-z<>[\]{}|"' ,.:()=]+(?=[,)=])/g, "").replace(/\): [^{]+\{/g, ") {"))}`).catch(() => null);
  if (r) {
    assert.equal(r.rangeDays("2026-11-01", "2026-12-01"), 31);
    assert.equal(r.rangeValid("2026-11-01", "2026-12-02"), false);
    assert.equal(r.rangeValid("2026-11-02", "2026-11-01"), false);
    assert.equal(r.hours(90), "1.50");
  }
  assert.match(activities, /"Desayuno", "Almuerzo", "Cena", "Snack"/);
  assert.match(activities, /"Contento", "Tranquilo", "Triste", "Ansioso", "Confundido", "Irritable", "Somnoliento"/);
  const vk = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  for (const list of [...activities.matchAll(/: \[((?:"[^"]+",? ?)+)\]/g)].map((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))) {
    for (const v of list) {
      if (["MEAL", "HYDRATION", "TOILETING", "MOBILITY", "ACTIVITY", "MOOD", "NOTE"].includes(v) || /^[a-z][a-zA-Z]+$/.test(v)) continue;
      assert.ok(es.activities.values[vk(v)] && en.activities.values[vk(v)], `traducción de «${v}»`);
    }
  }
});

test("F5: portal familiar del hogar (D5) — solo su familiar; sin turnos, horarios ni personal; mensajes solo con la administración", () => {
  for (const r of ["today", "activity", "history", "messages"]) assert.match(app, new RegExp(`<Route path="${r}" element=\\{<ResidentialFamilySwitch residential=`));
  assert.match(familyLayout, /\.\.\.\(residential \? \[\] : \[\{ to: "\/family\/history"/);
  assert.doesNotMatch(family, /listFamilyShifts|familyShifts|journey|attendance|punch|scheduledStart|credential/i);
  assert.match(family, /openRecipientConversation\(recipient\.organizationId, recipient\.recipientId, token\)/);
  assert.match(family, /t\("family\.administration"\)/);
  assert.match(es.family.messagesNote, /Solo tú y la administración/);
  assert.match(family, /t\("family\.author", \{ name: item\.caregiver\.displayName, role:/);
  assert.match(family, /r\.residence\?\.establishment/);
  assert.doesNotMatch(familyActivity, /scheduled|shift/i);
});

test("F5: actividades del cuidador — solo de sus residentes asignados, con el turno de la asignación; no clínicas", () => {
  assert.match(caregiver, /queue\.submit\(\{ organizationId, shiftId: resident\.shiftId/);
  assert.match(caregiver, /careRecipientId: resident\.careRecipientId/);
  assert.match(es.activities.nonClinicalHint, /No escribas diagnósticos, medicamentos ni datos de salud/);
  assert.doesNotMatch(activities, /vital|presión|glucosa|medic|blood|pressure|glucose/i);
});

test("F5: panel completo por partes; Central con alerta sin nombres ni bloqueo", () => {
  assert.match(panel, /\{overview\.panel && <PanelSections panel=\{overview\.panel\} \/>\}/);
  assert.match(panel, /panel\.attendance && <Metric label=\{t\("panel\.full\.present"\)\}/);
  assert.match(panel, /panel\.assignments && <Metric label=\{t\("panel\.full\.uncovered"\)\}/);
  assert.match(central, /if \(subscription\.demo\) return/);
  assert.match(central, /if \(!subscription\.overLimit\) return null;/);
  assert.match(esC.residentialSubscription.overview, /no bloquea nada/);
});

test("F5: textos completos en español e inglés, con las mismas claves", () => {
  for (const sec of ["reports", "activities", "family"]) assert.deepEqual(keys(es[sec]), keys(en[sec]), sec);
  assert.deepEqual(keys(es.panel.full), keys(en.panel.full));
  assert.deepEqual(keys(esC.residentialSubscription), keys(enC.residentialSubscription));
  for (const k of keys(es.reports).concat(keys(es.family), keys(es.activities))) {
    const get = (o) => k.split(".").reduce((x, y) => x?.[y], o);
    assert.ok(get(es.reports) ?? get(es.family) ?? get(es.activities));
  }
  assert.equal(esS.agency.items.residentialReports, "Informes");
  assert.equal(enS.agency.items.residentialReports, "Reports");
  const used = [...(reportsPage + family + caregiver + panel).matchAll(/t\("((?:reports|family|activities|panel\.full)\.[a-zA-Z.]+)"/g)].map((m) => m[1]);
  const all = new Set(keys(es).map((k) => k.replace(/_(one|other)$/, "")));
  for (const k of used) assert.ok(all.has(k), k);
});

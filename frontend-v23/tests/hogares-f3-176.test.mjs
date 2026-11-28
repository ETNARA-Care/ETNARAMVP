// 176 (hogares F3, 26-nov-2026): asignaciones de residentes y sustituciones en el portal.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const layout = read("src/layouts/AgencyLayout.tsx");
const caregiverLayout = read("src/layouts/CaregiverLayout.tsx");
const modality = read("src/features/residential/modality.ts");
const api = read("src/api/residentialAssignments.ts");
const admin = read("src/pages/agency/residential/ResidentialAssignmentsPage.tsx");
const mine = read("src/pages/caregiver/CaregiverResidentsPage.tsx");
const helpers = read("src/features/residential/assignments.ts");
const schedule = read("src/pages/agency/residential/ResidentialSchedulePage.tsx");
const esCat = JSON.parse(read("src/i18n/locales/es/residential.json")).assignments;
const enCat = JSON.parse(read("src/i18n/locales/en/residential.json")).assignments;
const esShell = JSON.parse(read("src/i18n/locales/es/shell.json"));
const enShell = JSON.parse(read("src/i18n/locales/en/shell.json"));

test("F3: rutas y menús solo para hogares y solo con HOGAR_ASIGNACIONES", () => {
  assert.match(modality, /RESIDENTIAL_ASSIGNMENTS_PATH = "\/agency\/hogar\/asignaciones"/);
  assert.match(modality, /CAREGIVER_RESIDENTS_PATH = "\/caregiver\/residentes"/);
  assert.match(app, /<Route path="hogar\/asignaciones" element=\{<FeatureRoute feature="HOGAR_ASIGNACIONES" fallback="\/agency\/hogar"><ResidentialAssignmentsPage\/><\/FeatureRoute>\}\/>/);
  assert.match(app, /<Route path="residentes" element=\{<FeatureRoute feature="HOGAR_ASIGNACIONES" fallback="\/caregiver"><CaregiverResidentsPage\/><\/FeatureRoute>\}\/>/);
  const res = layout.slice(layout.indexOf("const RESIDENTIAL:"), layout.indexOf("const RESIDENTIAL_GROUPS"));
  assert.match(res, /RESIDENTIAL_ASSIGNMENTS_PATH/);
  assert.match(layout, /\(residentialAssignments \|\| item\.to !== RESIDENTIAL_ASSIGNMENTS_PATH\)/);
  assert.match(caregiverLayout, /const myResidents = isResidentialOrganization\(activeOrganization\) && hasOrgFeature\(activeOrganization\?\.features, "HOGAR_ASIGNACIONES"\);/);
  assert.match(admin, /if \(!residential\) return <Navigate to="\/agency" replace \/>;/);
  assert.match(admin, /if \(!enabled\) return <Navigate to=\{RESIDENTIAL_PANEL_PATH\} replace \/>;/);
  assert.match(mine, /if \(!residential \|\| !enabled\) return <Navigate to="\/caregiver\/today" replace \/>;/);
});

test("F3: la sustitución solo se ofrece con HOGAR_CALENDARIO también encendido", () => {
  assert.match(admin, /const calendar = useOrgFeature\("HOGAR_CALENDARIO"\);/);
  assert.match(admin, /\{substitutions && <Button[^>]*onClick=\{\(\) => onSubstitute\(m\)\}/);
});

test("F3: solo el backend real; el portal no decide bloqueos ni acceso", () => {
  for (const p of ["/me", "/establishments", "/day?date=", "/residents", "/redistribute", "/history", "/coverage-alerts", "/preview"]) assert.ok(api.includes(p), p);
  assert.doesNotMatch(admin + mine + helpers, /mock|fixture/i);
  // Los bloqueos solo se muestran: vienen de la previa del backend y no hay forma de anularlos.
  assert.match(admin, /current\.blocks\.length === 0 && reasonCode/);
  assert.doesNotMatch(admin.replace(/assignments\.substitution\.noOverride/g, "") + api, /override|ignoreBlocks|force/i);
  assert.match(admin, /toast\.show\(ok, "success"\); close\(\); await load\(\); return true;/);
  // «Mis residentes» lista lo que devuelve el backend, sin filtrar ni completar.
  assert.match(mine, /const \{ residents \} = await assignmentsApi\.me\(organizationId, token\);/);
});

test("F3: sin cobertura exige confirmación y motivo; la disponibilidad se confirma; el motivo es una categoría", () => {
  assert.match(admin, /uncovered\.length === 0 \|\| \(confirmed && reason\.trim\(\)\.length >= 3\)/);
  assert.match(admin, /!current\.availabilityWarning \|\| availabilityOk/);
  assert.match(api, /SUBSTITUTION_REASONS = \["unplanned_absence", "operational", "schedule_change", "other"\] as const/);
  assert.match(admin, /hint=\{t\("assignments\.noHealthHint"\)\}/);
  assert.match(admin, /maxLength=\{300\}/);
});

test("F3: ayudas puras (anticipan, el backend decide)", async () => {
  const src = helpers.replace(/^import type .*\n/m, "").replace(/: Readonly<Record<string, string \| null>>|: readonly BoardResident\[\]|: readonly Move\[\]|: readonly string\[\]|: Record<string, string \| null>|: string\[\]|: string \| undefined|: Array<\{ careRecipientId: string; toMembershipId: string \}>|: string(?=[,)])/g, "")
    .replace(/\(e\): e is \[string, string\] =>/g, "(e) =>");
  const mod = await import(`data:text/javascript,${encodeURIComponent(src)}`);
  assert.equal(mod.puertoRicoLocalToIso("2026-11-26T14:30"), "2026-11-26T18:30:00.000Z");
  assert.equal(mod.puertoRicoLocalToIso(""), undefined);
  const residents = [{ id: "r1", coveredBy: ["a"] }, { id: "r2", coveredBy: ["a", "b"] }];
  assert.deepEqual(mod.uncoveredAfterMoves(residents, [{ careRecipientId: "r1", fromMembershipId: "a", toMembershipId: null }]), ["r1"]);
  assert.deepEqual(mod.uncoveredAfterMoves(residents, [{ careRecipientId: "r2", fromMembershipId: "a", toMembershipId: null }]), []);
  assert.deepEqual(mod.uncoveredAfterMoves(residents, [{ careRecipientId: "r1", fromMembershipId: "a", toMembershipId: "b" }]), []);
  assert.deepEqual(mod.uncoveredAfterSubstitution(residents, "a", ["r1", "r2"], { r1: null, r2: null }), ["r1"]);
  assert.deepEqual(mod.defaultTransfers(["r1", "r2"], "s"), { r1: "s", r2: "s" });
  assert.deepEqual(mod.transfersBody({ r1: "s", r2: null }), [{ careRecipientId: "r1", toMembershipId: "s" }]);
});

test("F3: el calendario semanal muestra quién cubre y desde cuándo", () => {
  assert.match(schedule, /entry\.substitution && <Badge tone="warning">\{t\("assignments\.scheduleSubstitution"/);
});

test("F3: textos completos en español e inglés, con las mismas claves", () => {
  const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort();
  assert.deepEqual(keys(esCat), keys(enCat));
  for (const k of keys(esCat)) {
    const v = k.split(".").reduce((o, x) => o[x], esCat), w = k.split(".").reduce((o, x) => o[x], enCat);
    assert.ok(typeof v === "string" && v.trim() && typeof w === "string" && w.trim(), k);
  }
  const used = [...(admin + mine + schedule + api).matchAll(/assignments\.([a-zA-Z_.]+?)(?:["`])/g)].map((m) => m[1]).filter((k) => !k.endsWith("."));
  const flat = new Set(keys(esCat).map((k) => k.replace(/_(one|other)$/, "")));
  for (const k of used) assert.ok(flat.has(k) || keys(esCat).some((x) => x.startsWith(`${k}.`)), k);
  for (const code of api.match(/"(RESIDENTIAL_[A-Z_]+|FEATURE_NOT_ENABLED|INVALID_INPUT)"/g).map((c) => c.slice(1, -1))) assert.ok(esCat.errors[code] && enCat.errors[code], code);
  for (const b of ["shift_cancelled", "shift_ended", "original_not_covering", "already_assigned", "substitute_inactive", "not_eligible", "role_mismatch", "not_authorized_in_establishment", "schedule_overlap"]) assert.ok(esCat.blocks[b] && enCat.blocks[b], b);
  assert.equal(esShell.agency.items.residentialAssignments, "Asignaciones");
  assert.equal(enShell.agency.items.residentialAssignments, "Assignments");
  assert.equal(esShell.caregiver.items.residents, "Residentes");
  assert.equal(enShell.caregiver.items.residents, "Residents");
});

test("F3: sin datos de salud en los textos ni en el portal", () => {
  assert.doesNotMatch(JSON.stringify(esCat.reasons) + JSON.stringify(enCat.reasons), /enferm|salud|médic|ill|sick|medical|health/i);
  assert.doesNotMatch(api, /diagnos|medical|health/i);
});

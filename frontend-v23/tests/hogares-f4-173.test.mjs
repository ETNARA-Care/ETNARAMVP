// 173–175 (hogares F4, 26-nov-2026): ponches, QR y geocerca en el portal.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const layout = read("src/layouts/AgencyLayout.tsx");
const caregiverLayout = read("src/layouts/CaregiverLayout.tsx");
const modality = read("src/features/residential/modality.ts");
const api = read("src/api/residentialAttendance.ts");
const admin = read("src/pages/agency/residential/ResidentialAttendancePage.tsx");
const punch = read("src/pages/caregiver/CaregiverPunchPage.tsx");
const helpers = read("src/features/residential/attendance.ts");
const esCat = JSON.parse(read("src/i18n/locales/es/residential.json")).attendance;
const enCat = JSON.parse(read("src/i18n/locales/en/residential.json")).attendance;

test("F4: rutas y menús solo para hogares y solo con HOGAR_PONCHES", () => {
  assert.match(modality, /RESIDENTIAL_ATTENDANCE_PATH = "\/agency\/hogar\/asistencia"/);
  assert.match(modality, /CAREGIVER_PUNCH_PATH = "\/caregiver\/ponchar"/);
  assert.match(app, /<Route path="hogar\/asistencia" element=\{<FeatureRoute feature="HOGAR_PONCHES" fallback="\/agency\/hogar"><ResidentialAttendancePage\/><\/FeatureRoute>\}\/>/);
  assert.match(app, /<Route path="ponchar" element=\{<FeatureRoute feature="HOGAR_PONCHES" fallback="\/caregiver"><CaregiverPunchPage\/><\/FeatureRoute>\}\/>/);
  const res = layout.slice(layout.indexOf("const RESIDENTIAL:"), layout.indexOf("const RESIDENTIAL_GROUPS"));
  assert.match(res, /RESIDENTIAL_ATTENDANCE_PATH/);
  assert.match(layout, /\(residentialAttendance \|\| item\.to !== RESIDENTIAL_ATTENDANCE_PATH\)/);
  assert.match(caregiverLayout, /const punches = isResidentialOrganization\(activeOrganization\) && hasOrgFeature\(activeOrganization\?\.features, "HOGAR_PONCHES"\);/);
  assert.match(caregiverLayout, /\.\.\.\(punches \? \[\{ to: CAREGIVER_PUNCH_PATH/);
  assert.match(admin, /if \(!residential\) return <Navigate to="\/agency" replace \/>;/);
  assert.match(admin, /if \(!enabled\) return <Navigate to=\{RESIDENTIAL_PANEL_PATH\} replace \/>;/);
  assert.match(punch, /if \(!residential \|\| !enabled\) return <Navigate to="\/caregiver\/today" replace \/>;/);
});

test("F4: solo el backend real; el portal no valida ni decide nada", () => {
  for (const p of ["/me/punch", "/me/consent", "/me/corrections", "/codes/print", "/codes/revoke", "/punches/review", "/corrections/", "/alerts/", "/policy", "/weeks/"]) assert.ok(api.includes(p), p);
  assert.doesNotMatch(admin + punch + helpers, /mock|fixture/i);
  assert.doesNotMatch(admin + punch, /"validated"\s*:\s*true|initial_validation/);
  assert.match(admin, /toast\.show\(ok, "success"\); close\(\); await load\(\); return true;/);
});

test("F4 privacidad: ubicación una sola vez al ponchar, solo con consentimiento; la cola sin conexión nunca lleva ubicación", () => {
  assert.equal((punch.match(/navigator\.geolocation\.getCurrentPosition/g) ?? []).length, 1);
  assert.doesNotMatch(punch + admin, /watchPosition/);
  assert.match(punch, /const location = data\?\.consent\.accepted \? await readLocationOnce\(\) : undefined;/);
  assert.match(punch, /maximumAge: 0/);
  const queued = punch.slice(punch.indexOf("const queued: QueuedPunch"), punch.indexOf("try {", punch.indexOf("const queued: QueuedPunch")));
  assert.doesNotMatch(queued, /location/);
  assert.match(helpers, /!\("location" in x\)/);
  assert.doesNotMatch(admin, /latitude|longitude/);
  assert.match(esCat.consent.body, /No hay rastreo y no se guardan coordenadas/);
  assert.match(enCat.consent.body, /There is no tracking and no coordinates are stored/);
});

test("F4: el QR y el código solo existen en la hoja de impresión (sin guardarse en el navegador); CSV seguro que aclara que no es nómina", () => {
  assert.match(admin, /import QRCode from "qrcode";/);
  assert.match(admin, /QRCode\.toDataURL\(punchLink\(window\.location\.origin, print\.qr\)/);
  assert.doesNotMatch(admin, /localStorage|sessionStorage|indexedDB/);
  assert.match(admin, /new Blob\(\[csvLines\(csv\)\]/);
  assert.match(esCat.week.csvNotice, /No es nómina/);
  assert.match(enCat.week.csvNotice, /It is not payroll/);
  assert.match(esCat.description, /Ninguna irregularidad elimina horas ni genera deducciones/);
});

test("F4 aislamiento: datos ligados a organización + establecimiento + semana; diálogos descartan respuestas atrasadas", () => {
  assert.match(admin, /const current = scopedTo\(state, organizationId, key\);/);
  assert.match(admin, /const dialog = dialogState && dialogState\.organizationId === organizationId \? dialogState\.dialog : null;/);
  assert.match(admin, /const printView = printState && printState\.organizationId === organizationId \? printState\.print : null;/);
  assert.match(punch, /const current = scopedTo\(state, organizationId\);/);
  assert.match(punch, /const myQueue = queue\.filter\(\(q\) => q\.organizationId === organizationId\);/);
  assert.equal((admin.match(/let active = true;/g) ?? []).length, 2);
});

{
  const ts = (await import("typescript")).default;
  const load = async (path) => {
    const src = read(path).replace(/^import type .*$/gm, "");
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  };
  const h = await load("src/features/residential/attendance.ts");
  const LOC = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const QR = `EA1.k1.${LOC}.2026-11-30.1.${"A".repeat(22)}`;

  test("F4 botones según la sesión (el servidor igual registra y marca cualquier orden)", () => {
    assert.deepEqual(h.availablePunchTypes({ openSession: false, breakOpen: false, mealOpen: false }), ["in"]);
    assert.deepEqual(h.availablePunchTypes({ openSession: true, breakOpen: false, mealOpen: false }), ["out", "break_start", "meal_start"]);
    assert.deepEqual(h.availablePunchTypes({ openSession: true, breakOpen: true, mealOpen: false }), ["break_end"]);
    assert.deepEqual(h.availablePunchTypes({ openSession: true, breakOpen: false, mealOpen: true }), ["meal_end"]);
  });
  test("F4 QR desde el enlace: solo la forma esperada; el enlace impreso abre «Ponchar»", () => {
    assert.equal(h.qrFromLink(`?c=${encodeURIComponent(QR)}`), QR);
    for (const bad of ["", "?c=", "?c=EA2.x", `?c=${QR}x`, "?c=<script>"]) assert.equal(h.qrFromLink(bad), null, bad);
    assert.equal(h.punchLink("https://app.example.invalid/", QR), `https://app.example.invalid/caregiver/ponchar?c=${encodeURIComponent(QR)}`);
  });
  test("F4 cola sin conexión: sin duplicados, máximo 50, descarta lo mal formado y cualquier elemento con ubicación", () => {
    const item = { clientEventId: "e1", organizationId: "o", shiftId: "s", type: "in", method: "pin", pin: "123456", declaredAt: "2026-11-26T12:00:00Z" };
    assert.equal(h.enqueue(h.enqueue([], item), item).length, 1);
    assert.deepEqual(h.parseQueue(JSON.stringify([item, { ...item, clientEventId: "e2", location: { latitude: 1 } }, 5, null])), [item]);
    assert.deepEqual(h.parseQueue("no es json"), []);
    let q = []; for (let i = 0; i < 60; i++) q = h.enqueue(q, { ...item, clientEventId: `e${i}` });
    assert.equal(q.length, 50);
  });
  test("F4 CSV: aviso de que no es nómina, cabecera traducida y horas validadas y pendientes por separado", async () => {
    const csv = await load("src/features/export/csv.ts");
    const rows = h.attendanceCsvRows("No es nómina", ["Turno", "Persona", "Entrada", "Salida", "Tarde", "Antes", "Ausencia", "Validadas", "Pendientes"], [
      { shiftId: "s", scheduledStart: "2026-11-30T11:00:00Z", membershipId: "m", workerName: "=CMD()", firstInAt: null, lastOutAt: null, lateMinutes: 0, earlyLeaveMinutes: 0, absent: true, openSession: false, validatedMinutes: 90, pendingMinutes: 30, breakMinutes: 0, mealMinutes: 0 },
    ], "Sí", "No");
    assert.deepEqual(rows[0], ["No es nómina"]);
    assert.deepEqual(rows[2].slice(6), ["Sí", "1.50", "0.50"]);
    assert.match(csv.csvLines(rows), /"'=CMD\(\)"/);
  });
}

test("F4: las pantallas no llevan textos visibles escritos en el código", () => {
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const [name, src] of [["administración", admin], ["ponchar", punch]]) {
    const body = strip(src);
    assert.doesNotMatch(body, /[^=]>[ \t]*[A-ZÁÉÍÓÚ¿«][a-záéíóúñ]+[^<{]*</, `${name}: texto entre etiquetas`);
    assert.doesNotMatch(body, /(label|title|hint|description|error|body|confirm|alt)=\{?["`][A-ZÁÉÍÓÚ¿«]/, `${name}: atributo con texto`);
    assert.doesNotMatch(body, /toast\.show\("[A-ZÁÉÍÓÚ]/, `${name}: aviso con texto`);
  }
});

test("F4: catálogo inglés con las mismas claves y marcadores, sin español; todos los errores y estados con texto", () => {
  const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const es = new Map(flat(esCat)), en = new Map(flat(enCat));
  assert.deepEqual([...en.keys()].sort(), [...es.keys()].sort());
  const marks = (v) => (String(v).match(/{{\w+}}/g) ?? []).sort().join();
  for (const [k, v] of es) assert.equal(marks(en.get(k)), marks(v), k);
  for (const [k, v] of en) assert.doesNotMatch(String(v), /\b(ponche|turno|semana|establecimiento|código|horas|motivo)\b/i, `en.${k} en español`);
  const codes = [...api.matchAll(/"((?:ATTENDANCE|RESIDENTIAL|FEATURE|INVALID)_[A-Z_]+)"/g)].map((m) => m[1]);
  for (const c of codes) { assert.ok(esCat.errors[c], `es ${c}`); assert.ok(enCat.errors[c], `en ${c}`); }
  for (const f of ["declared_in_future", "before_code", "outside_shift_window", "clock_skew", "impossible_order", "received_after_72h", "code_invalid", "transition_not_for_entry", "no_consent", "no_geofence_center", "duplicate_open_session"]) assert.ok(esCat.flags[f] && enCat.flags[f], f);
  const keys = [...(admin + punch).matchAll(/t\("(attendance\.[\w.]+)"/g)].map((m) => m[1].replace(/^attendance\./, ""));
  for (const k of keys) assert.ok(es.has(k) || es.has(`${k}_one`), `falta es.${k}`);
  assert.equal(JSON.parse(read("src/i18n/locales/en/shell.json")).caregiver.items.punch, "Punch");
  assert.equal(JSON.parse(read("src/i18n/locales/es/shell.json")).agency.items.residentialAttendance, "Asistencia");
});

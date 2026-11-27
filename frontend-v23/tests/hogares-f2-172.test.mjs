// 172 (hogares F2, 26-nov-2026): calendario semanal del establecimiento.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const layout = read("src/layouts/AgencyLayout.tsx");
const modality = read("src/features/residential/modality.ts");
const api = read("src/api/residentialSchedule.ts");
const page = read("src/pages/agency/residential/ResidentialSchedulePage.tsx");
const helpers = read("src/features/residential/schedule.ts");
const shifts = read("src/api/shifts.ts");
const esCat = JSON.parse(read("src/i18n/locales/es/residential.json")).schedule;
const enCat = JSON.parse(read("src/i18n/locales/en/residential.json")).schedule;

test("F2: ruta y menú solo para hogares y solo con HOGAR_CALENDARIO", () => {
  assert.match(modality, /RESIDENTIAL_SCHEDULE_PATH = "\/agency\/hogar\/calendario"/);
  assert.match(app, /<Route path="hogar\/calendario" element=\{<FeatureRoute feature="HOGAR_CALENDARIO" fallback="\/agency\/hogar"><ResidentialSchedulePage\/><\/FeatureRoute>\}\/>/);
  const res = layout.slice(layout.indexOf("const RESIDENTIAL:"), layout.indexOf("const RESIDENTIAL_GROUPS"));
  assert.match(res, /RESIDENTIAL_SCHEDULE_PATH/);
  const groups = layout.slice(layout.indexOf("const GROUPS:"), layout.indexOf("/* 160 (PR B)"));
  assert.doesNotMatch(groups, /RESIDENTIAL_SCHEDULE/);
  assert.match(layout, /const residentialSchedule = hasOrgFeature\(activeOrganization\?\.features, "HOGAR_CALENDARIO"\);/);
  assert.match(layout, /\(residentialSchedule \|\| item\.to !== RESIDENTIAL_SCHEDULE_PATH\)/);
  assert.match(page, /if \(!residential\) return <Navigate to="\/agency" replace \/>;/);
  assert.match(page, /if \(!enabled\) return <Navigate to=\{RESIDENTIAL_PANEL_PATH\} replace \/>;/);
});

test("F2: usa solo el backend real y vuelve a leer la semana tras cada cambio", () => {
  for (const p of ["/residential/schedule", "/establishments", "/weeks/", "/entries", "/copy", "/apply-template", "/publish", "/publications", "/templates"]) assert.ok(api.includes(p), p);
  assert.match(api, /apiClient\.(get|post|patch|delete)/);
  assert.doesNotMatch(page + api + helpers, /mock|fixture|localStorage|sessionStorage/i);
  assert.match(page, /toast\.show\(ok, "success"\); close\(\); await load\(\); return true;/);
  assert.match(page, /toast\.show\(scheduleErrorMessage\(e\), "danger"\); await load\(\); return false;/);
});

test("F2: el portal no cambia reglas: no decide elegibilidad ni bloquea a nadie por su cuenta", () => {
  // Cualquier persona activa se puede elegir; el backend aplica cumplimiento y solapes al publicar.
  assert.match(page, /schedule\.staff\.map\(\(s\) => <option key=\{s\.membershipId\} value=\{s\.membershipId\}>/);
  assert.doesNotMatch(page, /disabled=\{[^}]*eligib/);
  assert.match(esCat.dialogs.personHint, /Al publicar se comprueba el cumplimiento/);
  assert.match(esCat.draftExplain, /nadie del personal lo ve/);
  // Con avisos de solape o duplicado no se publica (igual que el backend: RESIDENTIAL_SCHEDULE_OVERLAP).
  assert.match(page, /busy=\{busy \|\| schedule\.warnings\.length > 0\}/);
});

test("F2: CSV seguro con csvLines y vista para imprimir", () => {
  assert.match(page, /import \{ csvLines \} from "@\/features\/export\/csv";/);
  assert.match(page, /new Blob\(\[csvLines\(rows\)\]/);
  assert.match(page, /window\.print\(\)/);
  assert.match(page, /print:hidden/);
  assert.match(page, /hidden print:block/);
});

test("F2: turnos del calendario se presentan «del establecimiento» (nunca la habitación técnica)", () => {
  assert.match(shifts, /establishment_name\?: string \| null;/);
  assert.match(shifts, /if\(shift\?\.establishment_name\)return i18n\.t\("residential:schedule\.establishmentShift",\{name:shift\.establishment_name\}\)/);
  for (const p of ["src/pages/agency/AgencyShiftsPage.tsx", "src/pages/agency/AgencyShiftDetailPage.tsx", "src/pages/caregiver/CaregiverShiftsPage.tsx", "src/pages/caregiver/CaregiverTodayPage.tsx", "src/pages/caregiver/CaregiverShiftDetailPage.tsx"]) {
    assert.match(read(p), /shiftRecipientName\(shift/, p);
  }
  assert.doesNotMatch(page + api, /room_id|__etnara_technical__/);
  assert.equal(esCat.establishmentShift, "Turno del establecimiento · {{name}}");
});

{
  const ts = (await import("typescript")).default;
  const load = async (path) => {
    const src = read(path).replace(/^import type .*$/gm, "");
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  };
  const h = await load("src/features/residential/schedule.ts");
  const lr = await load("src/features/residential/latestRequest.ts");
  const entry = (id, startsAt, endsAt, extra = {}) => ({ id, startsAt, endsAt, durationMinutes: Math.round((Date.parse(`${endsAt}:00Z`) - Date.parse(`${startsAt}:00Z`)) / 60000),
    requiredRole: "Cuidador/a", membershipId: null, workerName: null, label: null, published: false, removed: false, shiftStatus: null, assignmentStatus: null, ...extra });

  test("F2 fechas: Puerto Rico (UTC−4), lunes de la semana y siete días", () => {
    assert.equal(h.puertoRicoDate(new Date("2026-12-08T03:59:00Z")), "2026-12-07");
    assert.equal(h.puertoRicoDate(new Date("2026-12-08T04:00:00Z")), "2026-12-08");
    assert.equal(h.mondayOf("2026-12-13"), "2026-12-07"); // domingo → lunes anterior
    assert.equal(h.mondayOf("2026-12-07"), "2026-12-07");
    assert.deepEqual(h.weekDays("2026-12-28"), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
    assert.equal(h.isMonday("2026-12-07"), true);
    assert.equal(h.isMonday("2026-12-08"), false);
    assert.equal(h.isMonday("2026-02-30"), false);
  });

  test("F2 personal: solo se marca a quien el backend calculó como no apto; sin calcular no se marca", () => {
    const s = (eligibility) => ({ membershipId: "m", name: "x", role: null, eligibility });
    for (const e of ["not_eligible", "pending", "suspended", "expired", "action_required"]) assert.equal(h.staffNeedsReview(s(e)), true, e);
    for (const e of ["eligible", "unknown"]) assert.equal(h.staffNeedsReview(s(e)), false, e);
  });

  test("F2 cuadrícula: por día de inicio, ordenada, sin las quitadas", () => {
    const m = h.entriesByDay("2026-12-07", [
      entry("b", "2026-12-07T15:00", "2026-12-07T23:00"), entry("a", "2026-12-07T07:00", "2026-12-07T15:00"),
      entry("n", "2026-12-07T23:00", "2026-12-08T07:00"), entry("x", "2026-12-08T07:00", "2026-12-08T15:00", { removed: true }),
      entry("fuera", "2026-12-14T07:00", "2026-12-14T15:00"),
    ]);
    assert.deepEqual(m.get("2026-12-07").map((e) => e.id), ["a", "b", "n"]);
    assert.deepEqual(m.get("2026-12-08"), []);
    assert.equal([...m.values()].flat().some((e) => e.id === "fuera"), false);
  });

  test("F2 horas y plantilla desde la semana", () => {
    assert.equal(h.formatHours(450, "es"), "7.5 h"); // es-PR usa punto decimal
    assert.equal(h.formatHours(450, "en"), "7.5 h");
    const slots = h.slotsFromWeek([
      entry("a", "2026-12-07T07:00", "2026-12-07T15:00", { membershipId: "m1", workerName: "Ana" }),
      entry("b", "2026-12-07T07:00", "2026-12-07T15:00"),
      entry("n", "2026-12-13T23:00", "2026-12-14T07:00", { label: "noche" }),
      entry("q", "2026-12-08T07:00", "2026-12-08T15:00", { removed: true }),
    ]);
    assert.deepEqual(slots, [
      { weekday: 1, startTime: "07:00", durationMinutes: 480, requiredRole: "Cuidador/a", label: null, headcount: 2 },
      { weekday: 7, startTime: "23:00", durationMinutes: 480, requiredRole: "Cuidador/a", label: "noche", headcount: 1 },
    ]);
    assert.equal(JSON.stringify(slots).includes("m1"), false, "la plantilla no guarda personas");
  });

  test("F2 CSV: filas traducidas, sin las quitadas, nombres peligrosos neutralizados por csvLines", async () => {
    const csv = await load("src/features/export/csv.ts");
    const rows = h.scheduleCsvRows(["Fecha", "Inicio", "Fin", "Horas", "Rol", "Persona", "Etiqueta", "Estado"], [
      entry("a", "2026-12-07T07:00", "2026-12-07T15:00", { workerName: "=HYPERLINK(\"x\")", published: true }),
      entry("b", "2026-12-07T23:00", "2026-12-08T07:00"),
      entry("q", "2026-12-08T07:00", "2026-12-08T15:00", { removed: true }),
    ], { unassigned: "Sin asignar", published: "Publicado", draft: "Borrador" });
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[2], ["2026-12-07", "23:00", "2026-12-08 07:00", "8.00", "Cuidador/a", "Sin asignar", "", "Borrador"]);
    const text = csv.csvLines(rows);
    assert.match(text, /"'=HYPERLINK\(""x""\)"/);
  });

  test("F2 aislamiento: semana ligada a organización + establecimiento + semana; nada de otro hogar", async () => {
    const latest = lr.createLatestRequest(); let state = null;
    const open = (org, key, value) => { latest.invalidate(); const r = latest.begin(); return value.then((d) => { if (r.isCurrent()) state = { organizationId: org, key, data: d, error: false }; }); };
    let release; const slow = new Promise((r) => { release = r; });
    const first = open("H1", "E1|2026-12-07", slow);
    await open("H2", "E9|2026-12-07", Promise.resolve("semana de H2"));
    release("semana de H1"); await first;
    assert.equal(lr.scopedTo(state, "H2", "E9|2026-12-07").data, "semana de H2");
    assert.equal(lr.scopedTo(state, "H1", "E1|2026-12-07"), null);
    assert.equal(lr.scopedTo(state, "H2", "E9|2026-12-14"), null, "otra semana no reutiliza los datos");
    assert.match(page, /const current = scopedTo\(state, organizationId, key\);/);
    // Auditoría 26-nov: ligado a organización, establecimiento y semana (más estricto que solo la organización).
    assert.match(page, /const dialog = current \? scopedValue\(dialogState, organizationId, key\) : null;/);
    assert.match(page, /const chosen = selected && selected\.organizationId === organizationId \? selected\.locationId : null;/);
    assert.equal((page.match(/let active = true;/g) ?? []).length, 2);
    assert.equal((page.match(/return \(\) => \{ active = false; \};/g) ?? []).length, 2);
  });
}

test("F2: la pantalla no lleva textos visibles escritos en el código", () => {
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const body = strip(page);
  assert.doesNotMatch(body, /[^=]>[ \t]*[A-ZÁÉÍÓÚ¿«][a-záéíóúñ]+[^<{]*</, "texto entre etiquetas");
  assert.doesNotMatch(body, /(label|title|hint|description|error|body|confirm)=\{?["`][A-ZÁÉÍÓÚ¿«]/, "atributo con texto");
  assert.doesNotMatch(body, /toast\.show\("[A-ZÁÉÍÓÚ]/, "aviso con texto");
  assert.match(body, /useTranslation\("residential"\)/);
  assert.doesNotMatch(body, /toLocaleString\("es-PR"\)/);
});

test("F2: catálogo inglés con las mismas claves, marcadores y sin español; todos los errores con texto", () => {
  const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const es = new Map(flat(esCat)), en = new Map(flat(enCat));
  assert.deepEqual([...en.keys()].sort(), [...es.keys()].sort());
  const marks = (v) => (String(v).match(/{{\w+}}/g) ?? []).sort().join();
  for (const [k, v] of es) assert.equal(marks(en.get(k)), marks(v), k);
  for (const [k, v] of en) assert.doesNotMatch(String(v).replace("«Cuidador/a»", ""), /\b(turno|semana|establecimiento|plantilla|borrador|horas)\b/i, `en.${k} en español`);
  const codes = [...api.matchAll(/^\s+"([A-Z_]+)",$/gm)].map((m) => m[1]);
  assert.ok(codes.length >= 15);
  for (const c of codes) { assert.ok(esCat.errors[c], `es ${c}`); assert.ok(enCat.errors[c], `en ${c}`); }
  const keys = [...page.matchAll(/t\("(schedule\.[\w.]+)"/g)].map((m) => m[1].replace(/^schedule\./, ""));
  for (const k of keys) assert.ok(es.has(k) || es.has(`${k}_one`), `falta es.${k}`);
  assert.equal(JSON.parse(read("src/i18n/locales/en/shell.json")).agency.items.residentialSchedule, "Weekly schedule");
  assert.equal(JSON.parse(read("src/i18n/locales/es/shell.json")).agency.items.residentialSchedule, "Calendario semanal");
});

test("el diálogo del calendario va ligado a organización, establecimiento y semana y se descarta al cambiar", () => {
  assert.match(page, /useState<ScreenScoped<Dialog> \| null>\(null\)/);
  assert.match(page, /const key = locationId \? `\$\{locationId\}\|\$\{weekStart\}` : undefined;/);
  assert.match(page, /setDialogState\(\{ organizationId, key, value: d \}\)/);
  assert.match(page, /const screenKey = `\$\{organizationId \?\? ""\}\|\$\{key \?\? ""\}`;/);
  assert.match(page, /if \(dialogScreen !== screenKey\) \{ setDialogScreen\(screenKey\); setDialogState\(null\); \}/);
  assert.doesNotMatch(page, /dialogState\.organizationId === organizationId \? dialogState\.dialog/);
});

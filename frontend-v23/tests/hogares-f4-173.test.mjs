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
  const queued = punch.slice(punch.indexOf("const queued: QueueItem"), punch.indexOf("try {", punch.indexOf("const queued: QueueItem")));
  assert.ok(queued.length > 0);
  assert.doesNotMatch(queued, /location/);
  assert.match(read("src/features/residential/attendanceQueue.ts"), /!\("location" in \(v as object\)\)/);
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
  // La cola es de la persona Y de la organización (27-nov, A1), no solo de la organización.
  assert.match(punch, /const myItems = organizationId && userId \? mine\(queue, \{ userId, organizationId \}\) : \[\];/);
  assert.doesNotMatch(punch, /queue\.filter\(\(q\) => q\.organizationId === organizationId\)/);
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
  test("F4 QR desde el enlace: solo la forma esperada, en el FRAGMENTO (#c=, nunca llega a un servidor) y se borra de la barra", () => {
    assert.equal(h.qrFromLink(`#c=${encodeURIComponent(QR)}`), QR);
    for (const bad of ["", "#c=", "#c=EA2.x", `#c=${QR}x`, "#c=<script>", `?c=${encodeURIComponent(QR)}`]) assert.equal(h.qrFromLink(bad), null, bad);
    assert.equal(h.punchLink("https://app.example.invalid/", QR), `https://app.example.invalid/caregiver/ponchar#c=${encodeURIComponent(QR)}`);
    assert.match(punch, /window\.history\.replaceState\(window\.history\.state, "", window\.location\.pathname \+ window\.location\.search\)/);
    assert.doesNotMatch(punch, /qrFromLink\(routeLocation\.search\)/);
    assert.match(punch, /window\.addEventListener\("hashchange", take\)/);
  });
  // ---- Cola sin conexión (auditoría GPT del 27-nov, A1–A6): comportamiento real del módulo, sin React ni red.
  const qm = await load("src/features/residential/attendanceQueue.ts");
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, m }; };
  const base = { userId: "ana", organizationId: "o1", shiftId: "s", type: "in", method: "pin", pin: "123456", declaredAt: "2026-11-27T12:00:00Z", status: "pending" };
  const it = (id, extra = {}) => ({ ...base, clientEventId: id, ...extra });
  test("F4 cola · A1: cada ponche es de una persona y una organización; nadie más lo ve ni lo toca", () => {
    const st = mem();
    assert.equal(qm.addItem(st, it("a1")), "saved");
    assert.equal(qm.addItem(st, it("b1", { userId: "bea" })), "saved");
    assert.equal(qm.addItem(st, it("a2", { organizationId: "o2" })), "saved");
    const all = qm.readAll(st);
    assert.deepEqual(qm.mine(all, { userId: "ana", organizationId: "o1" }).map((i) => i.clientEventId), ["a1"]);
    assert.deepEqual(qm.mine(all, { userId: "bea", organizationId: "o1" }).map((i) => i.clientEventId), ["b1"]);
    // Quitar el de Bea no toca los de Ana.
    assert.equal(qm.updateItem(st, "b1", () => null), true);
    assert.deepEqual(qm.readAll(st).map((i) => i.clientEventId), ["a1", "a2"]);
    assert.match(punch, /mine\(queue, \{ userId, organizationId \}\)/);
    assert.match(punch, /mine\(readAll\(store\(\)\), owner\)\.find\(\(i\) => i\.status === "pending"/);
  });
  test("F4 cola · A2: los cambios releen y no pisan lo que otro guardó mientras tanto; candado común y un solo envío", async () => {
    const st = mem();
    qm.addItem(st, it("e1"));
    // Un envío «lee» e1; mientras está en la red se guarda e2; al terminar quita SOLO e1.
    const sending = qm.readAll(st)[0];
    assert.equal(qm.addItem(st, it("e2")), "saved");
    qm.updateItem(st, sending.clientEventId, () => null);
    assert.deepEqual(qm.readAll(st).map((i) => i.clientEventId), ["e2"]);
    // Candado de la pestaña: las operaciones van de una en una y en orden.
    const order = [];
    await Promise.all([1, 2, 3].map((n) => qm.withQueueLock(async () => { order.push(`in${n}`); await new Promise((r) => setTimeout(r, 5)); order.push(`out${n}`); })));
    assert.deepEqual(order, ["in1", "out1", "in2", "out2", "in3", "out3"]);
    // Un segundo envío simultáneo no hace nada.
    let runs = 0;
    const slow = () => qm.withFlushLock(async () => { runs++; await new Promise((r) => setTimeout(r, 10)); });
    const [r1, r2] = await Promise.all([slow(), slow()]);
    assert.equal(runs, 1); assert.deepEqual([r1, r2].sort(), [false, true]);
    assert.match(read("src/features/residential/attendanceQueue.ts"), /l\.request\("etnara-attendance-queue"/);
    assert.match(read("src/features/residential/attendanceQueue.ts"), /l\.request\("etnara-attendance-flush", \{ ifAvailable: true \}/);
    assert.match(punch, /window\.addEventListener\("storage", onStorage\)/);
  });
  test("F4 cola · A3: si el almacenamiento falla o está lleno, se dice; nunca un «guardado» falso", () => {
    const full = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } };
    assert.equal(qm.addItem(full, it("x")), "storage_failed");
    const lies = { getItem: () => "[]", setItem: () => {} }; // acepta pero no guarda
    assert.equal(qm.addItem(lies, it("x")), "storage_failed");
    assert.equal(qm.addItem(null, it("x")), "storage_failed");
    assert.match(punch, /else toast\.show\(t\("attendance\.punch\.saveFailed"\), "danger"\);/);
    assert.match(esCat.punch.saveFailed, /NO quedó registrado/); assert.match(enCat.punch.saveFailed, /NOT recorded/);
  });
  test("F4 cola · A4: con 50 pendientes de la misma persona el nuevo NO se guarda y se avisa; nunca se borra uno antiguo", () => {
    const st = mem();
    for (let i = 0; i < qm.MAX_PENDING; i++) assert.equal(qm.addItem(st, it(`p${i}`)), "saved");
    assert.equal(qm.addItem(st, it("p50")), "full");
    const ids = qm.readAll(st).map((i) => i.clientEventId);
    assert.equal(ids.length, 50); assert.equal(ids[0], "p0");
    // Otra persona del mismo teléfono no queda bloqueada por los de Ana.
    assert.equal(qm.addItem(st, it("bea1", { userId: "bea" })), "saved");
    // La lectura nunca recorta; solo ignora lo mal formado o con ubicación.
    const raw = JSON.stringify([...Array.from({ length: 70 }, (_, i) => it(`r${i}`)), { ...it("loc"), location: { latitude: 1 } }, 5, null]);
    assert.equal(qm.parseItems(raw).length, 70);
    assert.deepEqual(qm.parseItems("no es json"), []);
    assert.match(punch, /else if \(saved === "full"\) toast\.show\(t\("attendance\.punch\.queueFull", \{ max: MAX_PENDING \}\), "danger"\);/);
  });
  test("F4 cola · A5: cada error según su causa; 401, 403, 404, 408 y 429 nunca borran el ponche", () => {
    const c = (status, code, net) => qm.classifyQueueError(net ? { isNetworkError: true, status: 0 } : { status, code });
    assert.deepEqual(c(0, null, true), { kind: "retry" });
    for (const st of [500, 502, 503, 408, 429]) assert.deepEqual(c(st), { kind: "retry" }, String(st));
    assert.deepEqual(c(401, "UNAUTHORIZED"), { kind: "hold", hold: "auth" });
    assert.deepEqual(c(404, "FEATURE_NOT_ENABLED"), { kind: "hold", hold: "feature" });
    assert.deepEqual(c(403, "ATTENDANCE_NOT_AUTHORIZED"), { kind: "rejected", status: 403, code: "ATTENDANCE_NOT_AUTHORIZED" });
    assert.deepEqual(c(404, "RESIDENTIAL_NOT_FOUND"), { kind: "rejected", status: 404, code: "RESIDENTIAL_NOT_FOUND" });
    assert.deepEqual(c(409, "ATTENDANCE_DUPLICATE_EVENT"), { kind: "rejected", status: 409, code: "ATTENDANCE_DUPLICATE_EVENT" });
    // En la página: solo un envío aceptado quita el ponche; lo demás espera o queda «no aceptado».
    const flushSrc = punch.slice(punch.indexOf("const flush = useCallback"), punch.indexOf("useEffect(() => {\n    const onOnline"));
    assert.equal((flushSrc.match(/updateItem\(store\(\), item\.clientEventId, \(\) => null\)/g) ?? []).length, 1);
    assert.match(flushSrc, /if \(d\.kind === "retry"\) break;/);
    assert.match(flushSrc, /status: "rejected"/);
  });
  test("F4 cola · A6: lo no aceptado queda a la vista con su explicación: reintentar, pedir una corrección o descartar (con confirmación)", () => {
    assert.match(punch, /data-testid="punch-rejected"/);
    assert.match(punch, /attendanceErrorMessage\(\{ status: i\.rejection\?\.status, code: i\.rejection\?\.code \?\? undefined \}\)/);
    assert.match(punch, /onClick=\{\(\) => void retryRejected\(i\.clientEventId\)\}/);
    assert.match(punch, /<CorrectionForm organizationId=\{organizationId\} shiftId=\{i\.shiftId\} punches=\{\[\]\} initialOpen initialType=\{i\.type\}/);
    assert.match(punch, /t\("attendance\.punch\.discardConfirm"\)/);
    for (const cat of [esCat, enCat]) for (const k of ["rejectedTitle_one", "rejectedTitle_other", "rejectedDetail", "retry", "discard", "discardConfirm", "holdAuth", "holdFeature", "queueFull", "saveFailed"]) assert.ok(cat.punch[k], k);
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

test("27-nov · la cola sin conexión no se reintenta en bucle: solo al volver la señal, al abrir la pantalla o a petición", () => {
  assert.doesNotMatch(punch, /setInterval\(/);
  assert.match(punch, /window\.addEventListener\("online", onOnline\)/);
});

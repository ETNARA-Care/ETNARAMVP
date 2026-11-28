// 171 (hogares F1, 25-nov-2026): establecimientos, unidades, habitaciones, camas, ubicación, geocerca y cierre.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const layout = read("src/layouts/AgencyLayout.tsx");
const modality = read("src/features/residential/modality.ts");
const api = read("src/api/residential.ts");
const list = read("src/pages/agency/residential/ResidentialEstablishmentsPage.tsx");
const detail = read("src/pages/agency/residential/ResidentialEstablishmentPage.tsx");
const occ = read("src/pages/agency/residential/OccupancySummary.tsx");
const pages = list + detail + occ;
// F0.1/F1 (26-nov): los textos viven en el catálogo «residential» (es/en).
const esCat = JSON.parse(read("src/i18n/locales/es/residential.json")).establishments;
const enCat = JSON.parse(read("src/i18n/locales/en/residential.json")).establishments;
const esText = JSON.stringify(esCat);

test("rutas y menú de F1 solo para hogares", () => {
  assert.match(modality, /RESIDENTIAL_ESTABLISHMENTS_PATH = "\/agency\/hogar\/establecimientos"/);
  assert.match(app, /<Route path="hogar\/establecimientos" element=\{<ResidentialEstablishmentsPage\/>\}\/>/);
  assert.match(app, /<Route path="hogar\/establecimientos\/:establishmentId" element=\{<ResidentialEstablishmentPage\/>\}\/>/);
  const res = layout.slice(layout.indexOf("const RESIDENTIAL:"), layout.indexOf("const RESIDENTIAL_GROUPS"));
  assert.match(res, /RESIDENTIAL_ESTABLISHMENTS_PATH/);
  const groups = layout.slice(layout.indexOf("const GROUPS:"), layout.indexOf("/* 160 (PR B)"));
  assert.doesNotMatch(groups, /RESIDENTIAL_/);
  for (const page of [list, detail]) assert.match(page, /if \(!residential\) return <Navigate to="\/agency" replace \/>/);
});

test("usa solo el backend real (cliente compartido, rutas /residential) y vuelve a leer tras cada cambio", () => {
  for (const p of ["/establishments", "/units/", "/rooms/", "/residents/", "/placement", "/geofence", "/closure-check", "/close"]) assert.ok(api.includes(p), p);
  assert.match(api, /apiClient\.(get|post|patch|put)/);
  assert.doesNotMatch(pages, /mock|fixture|localStorage/i);
  assert.match(detail, /toast\.show\(ok, "success"\); setDialog\(null\); await load\(\);/);
});

test("camas: nunca se presentan como capacidad autorizada; superarlas solo avisa", () => {
  assert.match(esCat.occupancy.disclaimer, /No equivale a la capacidad autorizada por el Departamento de la Familia/);
  assert.match(enCat.occupancy.disclaimer, /not the capacity authorized by the Department of the Family/);
  assert.doesNotMatch(esText.replace(/No equivale a la capacidad autorizada por el Departamento de la Familia/g, ""), /capacidad autorizada|autorizad[ao] por el Departamento/i);
  assert.match(esCat.occupancy.overCapacity, /Es solo un aviso: no se bloquea nada/);
  assert.match(esCat.dialogs.fullWarning, /Puedes guardar igualmente: es solo un aviso/);
  assert.equal(esCat.occupancy.notConfigured, "Sin configurar");
  assert.match(occ, /t\("establishments\.occupancy\.disclaimer"\)/);
  assert.match(detail, /t\("establishments\.dialogs\.fullWarning"\)/);
});

test("geocerca: 50–300 m, motivo obligatorio, sin rastreo ni ubicaciones de personas", () => {
  assert.match(detail, /r >= 50 && r <= 300/);
  assert.match(detail, /reason\.trim\(\)\.length >= 3/);
  assert.match(esCat.geofence.explain, /nunca impide un ponche, no rastrea y no guarda la ubicación de las personas/);
  assert.match(enCat.geofence.explain, /never blocks a clock-in, does not track and does not store people's location/);
  assert.match(detail, /t\("establishments\.geofence\.explain"\)/);
  assert.doesNotMatch(detail, /navigator\.geolocation/);
});

test("cierre: comprobación previa, motivo y confirmación escrita; nada se borra", () => {
  assert.match(detail, /residentialApi\.closureCheck/);
  assert.match(detail, /check\?\.canClose === true && reason\.trim\(\)\.length >= 3 && typed\.trim\(\) === name\.trim\(\)/);
  assert.match(esCat.closure.explain, /No se borra nada/);
  assert.match(esCat.closure.willArchive, /No se borra nada/);
});

test("nunca muestra piezas técnicas ni datos clínicos", () => {
  assert.doesNotMatch(pages, /__etnara|technical|técnic/i);
  assert.doesNotMatch(pages, /diagn|medicament|alergi|clínic/i);
});

test("errores de las reglas del backend con mensajes claros", () => {
  for (const code of ["RESIDENTIAL_NAME_TAKEN", "RESIDENTIAL_UNIT_HAS_ACTIVE_ROOMS", "RESIDENTIAL_ROOM_HAS_RESIDENTS", "RESIDENTIAL_CLOSURE_FUTURE_SHIFTS", "RESIDENTIAL_CLOSURE_ACTIVE_RESIDENTS", "RESIDENTIAL_CLOSURE_REQUIRED"]) {
    assert.match(api, new RegExp(`"${code}",`));
    assert.ok(esCat.errors[code] && enCat.errors[code], code);
  }
  assert.match(api, /i18n\.t\(`residential:establishments\.errors\.\$\{code as ResidentialErrorCode\}`\)/);
});

test("F1 171: Configuración (pantalla antigua) remite al cierre del hogar con un mensaje claro", () => {
  const page = read("src/pages/agency/AgencyOrganizationSettingsPage.tsx");
  const modality = read("src/features/residential/modality.ts");
  assert.match(page, /isResidentialOrganization\(activeOrganization\)/);
  assert.match(page, /RESIDENTIAL_CLOSURE_REQUIRED" \? i18n\.t\(RESIDENTIAL_CLOSURE_REQUIRED_MESSAGE_KEY\)/);
  assert.match(page, /residential\s*\?[\s\S]*RESIDENTIAL_ESTABLISHMENTS_PATH[\s\S]*establishments\.settings\.closeButton[\s\S]*: <Button[^>]*>[\s\S]*Archivar/);
  assert.match(modality, /RESIDENTIAL_CLOSURE_REQUIRED_MESSAGE_KEY = "residential:establishments\.settings\.closureRequired"/);
  assert.match(esCat.settings.closureRequired, /Cerrar establecimiento/);
  assert.match(enCat.settings.closureRequired, /Close facility/);
});

test("F1 171: sin tope de camas por habitación en el portal; mensaje de traslado con turnos", () => {
  const page = read("src/pages/agency/residential/ResidentialEstablishmentPage.tsx");
  const api = read("src/api/residential.ts");
  assert.doesNotMatch(page, /bedValue <= 20\b/);
  assert.doesNotMatch(page, /Entre 1 y 20/);
  assert.match(page, /bedValue >= 1/);
  assert.match(api, /"RESIDENTIAL_TRANSFER_ACTIVE_SHIFTS",/);
  assert.match(esCat.errors.RESIDENTIAL_TRANSFER_ACTIVE_SHIFTS, /turnos vigentes o futuros/);
});

// Protección de cambio de organización en las pantallas de establecimientos (25-nov, como A4 en el panel).
{
  const ts = (await import("typescript")).default;
  const src = readFileSync(new URL("../src/features/residential/latestRequest.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const lr = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
  /** Flujo de las pantallas: cada cambio (organización o establecimiento) invalida la carga anterior y empieza otra. */
  const screen = () => {
    const latest = lr.createLatestRequest(); let state = null; let active = { org: null, key: undefined }; const seen = [];
    const visible = () => lr.scopedTo(state, active.org, active.key);
    const record = () => { const v = visible(); seen.push({ ...active, shown: v ? `${v.organizationId}/${v.key ?? ""}` : null }); };
    return {
      open(org, key, residential, response) {
        latest.invalidate(); active = { org, key }; record();
        if (!residential) return Promise.resolve();
        const req = latest.begin();
        return response.then((data) => { if (req.isCurrent()) state = { organizationId: org, key, data, error: false }; record(); },
          () => { if (req.isCurrent()) state = { organizationId: org, key, data: null, error: true }; record(); });
      }, visible, seen,
    };
  };
  const neverForeign = (seen) => seen.every((s) => s.shown === null || s.shown === `${s.org}/${s.key ?? ""}`);

  test("171 org-switch: lista de establecimientos, dos hogares con respuestas fuera de orden y cambios rápidos", async () => {
    const p = screen(); const r = [deferred(), deferred(), deferred(), deferred()];
    const runs = ["H1", "H2", "H1", "H2"].map((o, i) => p.open(o, undefined, true, r[i].promise));
    r[3].resolve(["Casa de H2"]); r[0].resolve(["Casa de H1"]); r[2].reject(new Error("tarde")); r[1].resolve(["otra"]);
    await Promise.all(runs);
    assert.deepEqual([p.visible().organizationId, p.visible().data], ["H2", ["Casa de H2"]]);
    assert.ok(neverForeign(p.seen), JSON.stringify(p.seen));
  });

  test("171 org-switch: detalle ligado a organización Y establecimiento; nada visible en agencia ni independiente", async () => {
    const p = screen(); const a = deferred(), b = deferred(), c = deferred();
    const r1 = p.open("H1", "E1", true, a.promise);
    const r2 = p.open("H1", "E2", true, b.promise);
    b.resolve({ name: "E2" }); await r2; a.resolve({ name: "E1" }); await r1;
    assert.equal(p.visible().data.name, "E2", "la respuesta atrasada de otro establecimiento no sobrescribe");
    await p.open("AGENCIA", "E2", false); assert.equal(p.visible(), null);
    await p.open("INDEPENDIENTE", "E2", false); assert.equal(p.visible(), null);
    const r3 = p.open("H2", "E2", true, c.promise); assert.equal(p.visible(), null, "otro hogar no ve el detalle anterior aunque el id coincida");
    c.resolve({ name: "E2 de H2" }); await r3;
    assert.equal(p.visible().data.name, "E2 de H2");
    assert.ok(neverForeign(p.seen), JSON.stringify(p.seen));
  });

  test("171 org-switch: ambas pantallas usan la carga ligada y los diálogos descartan respuestas atrasadas", () => {
    const list = read("src/pages/agency/residential/ResidentialEstablishmentsPage.tsx");
    const detail = read("src/pages/agency/residential/ResidentialEstablishmentPage.tsx");
    for (const s of [list, detail]) {
      assert.match(s, /const request = latest\.current\.begin\(\);/);
      assert.match(s, /if \(request\.isCurrent\(\)\) setState\(/);
      assert.match(s, /return \(\) => tracker\.invalidate\(\);/);
      assert.doesNotMatch(s, /setItems\(\(await|setData\(detail|setError\(/);
    }
    assert.match(list, /const current = scopedTo\(state, organizationId\);/);
    assert.match(detail, /const current = scopedTo\(state, organizationId, establishmentId\);/);
    // Auditoría 26-nov: el diálogo va ligado a la organización y al establecimiento (más estricto que solo la organización).
    assert.match(detail, /const dialog = data && data\.establishment\.id === establishmentId \? scopedValue\(dialogState, organizationId, establishmentId\) : null;/);
    // Diálogos (ubicar, historial, geocerca, cierre): cada efecto descarta su respuesta si cambió la organización.
    assert.equal((detail.match(/let active = true;/g) ?? []).length, 4);
    assert.equal((detail.match(/return \(\) => \{ active = false; \};/g) ?? []).length, 4);
  });
}

// F1 (26-nov): traducción completa es/en de las pantallas de F1.
test("F1: las pantallas de establecimientos no llevan textos visibles escritos en el código", () => {
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const [name, src] of [["lista", list], ["detalle", detail], ["ocupación", occ]]) {
    const body = strip(src);
    assert.doesNotMatch(body, /[^=]>[ \t]*[A-ZÁÉÍÓÚ¿«][a-záéíóúñ]+[^<{]*</, `${name}: texto entre etiquetas`); // «=>» (tipos) no cuenta
    assert.doesNotMatch(body, /(label|title|hint|description|error)=\{?["`][A-ZÁÉÍÓÚ¿«]/, `${name}: atributo con texto`);
    assert.doesNotMatch(body, /toast\.show\("[A-ZÁÉÍÓÚ]/, `${name}: aviso con texto`);
    assert.match(body, /useTranslation\("residential"\)/);
  }
  assert.doesNotMatch(strip(detail), /toLocaleString\("es-PR"\)/, "fechas en el idioma activo");
});

test("F1: el catálogo inglés de establecimientos tiene las mismas claves y los mismos marcadores", () => {
  const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const es = new Map(flat(esCat)), en = new Map(flat(enCat));
  assert.deepEqual([...en.keys()].sort(), [...es.keys()].sort());
  const marks = (v) => (String(v).match(/{{\w+}}/g) ?? []).sort().join();
  for (const [k, v] of es) assert.equal(marks(en.get(k)), marks(v), k);
  for (const [k, v] of en) assert.doesNotMatch(String(v), /\b(habitación|establecimiento|residentes|camas|unidad)\b/i, `en.${k} en español`);
  assert.equal(JSON.parse(read("src/i18n/locales/en/shell.json")).agency.items.residentialEstablishments, "Facilities and rooms");
});

// Auditoría 26-nov: el diálogo abierto va ligado a la organización Y al establecimiento.
{
  const ts = (await import("typescript")).default;
  const src = readFileSync(new URL("../src/features/residential/latestRequest.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const lr = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  test("scopedValue: solo devuelve el diálogo en la misma organización y el mismo establecimiento", () => {
    const open = { organizationId: "org-1", key: "est-A", value: { kind: "room", roomId: "room-A" } };
    assert.deepEqual(lr.scopedValue(open, "org-1", "est-A"), open.value);
    assert.equal(lr.scopedValue(open, "org-1", "est-B"), null, "otro establecimiento de la misma organización");
    assert.equal(lr.scopedValue(open, "org-2", "est-A"), null, "otra organización");
    assert.equal(lr.scopedValue(open, "", "est-A"), null);
    assert.equal(lr.scopedValue(open, "org-1", ""), null);
    assert.equal(lr.scopedValue(null, "org-1", "est-A"), null);
  });
  test("la ficha del establecimiento liga el diálogo al establecimiento y lo descarta al cambiar", () => {
    assert.match(detail, /useState<ScreenScoped<Dialog> \| null>\(null\)/);
    assert.match(detail, /scopedValue\(dialogState, organizationId, establishmentId\)/);
    assert.match(detail, /data && data\.establishment\.id === establishmentId \? scopedValue/);
    assert.match(detail, /setDialogState\(d \? \{ organizationId, key: establishmentId, value: d \} : null\)/);
    // Cambio de organización o de establecimiento: se descarta durante el render (no reaparece al volver).
    assert.match(detail, /const screenKey = `\$\{organizationId\}:\$\{establishmentId\}`;/);
    assert.match(detail, /if \(dialogScreen !== screenKey\) \{ setDialogScreen\(screenKey\); setDialogState\(null\); \}/);
    assert.doesNotMatch(detail, /dialogState\.organizationId === organizationId \? dialogState\.dialog/);
  });
}

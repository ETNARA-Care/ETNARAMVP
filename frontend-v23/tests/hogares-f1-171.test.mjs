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
  assert.match(occ, /No equivale a la capacidad autorizada por el Departamento de la Familia/);
  assert.doesNotMatch(pages.replace(/No equivale a la capacidad autorizada por el Departamento de la Familia/g, ""), /capacidad autorizada|autorizad[ao] por el Departamento/i);
  assert.match(occ, /Es solo un aviso: no se bloquea nada/);
  assert.match(detail, /Puedes guardar igualmente: es solo un aviso/);
  assert.match(occ, /"Sin configurar"/);
});

test("geocerca: 50–300 m, motivo obligatorio, sin rastreo ni ubicaciones de personas", () => {
  assert.match(detail, /r >= 50 && r <= 300/);
  assert.match(detail, /reason\.trim\(\)\.length >= 3/);
  assert.match(detail, /nunca impide un ponche, no rastrea y no guarda la ubicación de las personas/);
  assert.doesNotMatch(detail, /navigator\.geolocation/);
});

test("cierre: comprobación previa, motivo y confirmación escrita; nada se borra", () => {
  assert.match(detail, /residentialApi\.closureCheck/);
  assert.match(detail, /check\?\.canClose === true && reason\.trim\(\)\.length >= 3 && typed\.trim\(\) === name\.trim\(\)/);
  assert.match(detail, /No se borra nada/);
});

test("nunca muestra piezas técnicas ni datos clínicos", () => {
  assert.doesNotMatch(pages, /__etnara|technical|técnic/i);
  assert.doesNotMatch(pages, /diagn|medicament|alergi|clínic/i);
});

test("errores de las reglas del backend con mensajes claros", () => {
  for (const code of ["RESIDENTIAL_NAME_TAKEN", "RESIDENTIAL_UNIT_HAS_ACTIVE_ROOMS", "RESIDENTIAL_ROOM_HAS_RESIDENTS", "RESIDENTIAL_CLOSURE_FUTURE_SHIFTS", "RESIDENTIAL_CLOSURE_ACTIVE_RESIDENTS", "RESIDENTIAL_CLOSURE_REQUIRED"]) assert.match(api, new RegExp(`${code}: "`));
});

test("F1 171: Configuración (pantalla antigua) remite al cierre del hogar con un mensaje claro", () => {
  const page = read("src/pages/agency/AgencyOrganizationSettingsPage.tsx");
  const modality = read("src/features/residential/modality.ts");
  assert.match(page, /isResidentialOrganization\(activeOrganization\)/);
  assert.match(page, /RESIDENTIAL_CLOSURE_REQUIRED" \? RESIDENTIAL_CLOSURE_REQUIRED_MESSAGE/);
  assert.match(page, /residential\s*\?[\s\S]*RESIDENTIAL_ESTABLISHMENTS_PATH[\s\S]*Cerrar establecimiento[\s\S]*: <Button[^>]*>[\s\S]*Archivar/);
  assert.match(modality, /RESIDENTIAL_CLOSURE_REQUIRED_MESSAGE =[\s\S]*Cerrar establecimiento/);
});

test("F1 171: sin tope de camas por habitación en el portal; mensaje de traslado con turnos", () => {
  const page = read("src/pages/agency/residential/ResidentialEstablishmentPage.tsx");
  const api = read("src/api/residential.ts");
  assert.doesNotMatch(page, /bedValue <= 20\b/);
  assert.doesNotMatch(page, /Entre 1 y 20/);
  assert.match(page, /bedValue >= 1/);
  assert.match(api, /RESIDENTIAL_TRANSFER_ACTIVE_SHIFTS: "/);
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
    assert.match(detail, /const dialog = dialogState && dialogState\.organizationId === organizationId \? dialogState\.dialog : null;/);
    // Diálogos (ubicar, historial, geocerca, cierre): cada efecto descarta su respuesta si cambió la organización.
    assert.equal((detail.match(/let active = true;/g) ?? []).length, 4);
    assert.equal((detail.match(/return \(\) => \{ active = false; \};/g) ?? []).length, 4);
  });
}

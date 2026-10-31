// Fotos de actividades E3 (31-oct-2026): Portal Familiar.
// La familia solo ve las fotos que el backend le envía en cada respuesta (aprobadas y con consentimiento),
// nunca guarda copias, el visor se cierra si la foto deja de estar compartida y no hay botón de descarga.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clampZoom, familyPhotos, MAX_ZOOM, neighbour, pinchDistance, stillShared } from "../src/features/activityPhotos/familyPhotos.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const es = JSON.parse(read("src/i18n/locales/es/photos.json"));
const en = JSON.parse(read("src/i18n/locales/en/photos.json"));
const item = (id, photo, extra = {}) => ({ id, type: "MEAL", occurredAt: "2026-10-31T16:00:00Z", title: "Comida", summary: "Almuerzo", caregiver: { displayName: "Cuidadora", role: null }, ...(photo ? { photo } : {}), ...extra });

test("E3.1 solo se muestran las fotos cuya referencia envió el backend en esta respuesta", () => {
  const photos = familyPhotos([
    item("a", { visible: true, reference: "p1" }),
    item("b", { visible: false }),          // actividad PHOTO sin imagen autorizada
    item("c"),                              // sin foto
    item("d", { visible: true }),           // sin referencia: nada que mostrar
    item("e", { visible: true, reference: "p1" }), // repetida
    item("f", { visible: true, reference: "p2" }),
  ]);
  assert.deepEqual(photos.map((p) => p.id), ["p1", "p2"]);
  assert.deepEqual(photos.map((p) => p.itemId), ["a", "f"]);
});

test("E3.2 retirada o consentimiento revocado: en cuanto la lista no la trae, el visor se cierra", () => {
  const before = familyPhotos([item("a", { visible: true, reference: "p1" }), item("b", { visible: true, reference: "p2" })]);
  const after = familyPhotos([item("a"), item("b", { visible: true, reference: "p2" })]);
  assert.equal(stillShared(before, "p1"), true);
  assert.equal(stillShared(after, "p1"), false);
  assert.equal(stillShared(after, null), false);
  const hook = code("src/features/activityPhotos/useFamilyPhotoViewer.tsx");
  assert.match(hook, /const gone = openId !== null && !stillShared\(photos, openId\);/);
  assert.match(hook, /organizationId && openId && !gone\s*\n?\s*\? <FamilyPhotoViewer/, "nunca se dibuja una foto que ya no está compartida");
});

test("E3.3 navegación y ampliación del visor", () => {
  const photos = familyPhotos([item("a", { visible: true, reference: "p1" }), item("b", { visible: true, reference: "p2" })]);
  assert.equal(neighbour(photos, "p1", 1), "p2");
  assert.equal(neighbour(photos, "p1", -1), null);
  assert.equal(neighbour(photos, "p2", 1), null);
  assert.equal(neighbour(photos, "zz", 1), null);
  assert.equal(pinchDistance({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 }), 5);
  assert.equal(clampZoom(0.2), 1);
  assert.equal(clampZoom(9), MAX_ZOOM);
  assert.equal(clampZoom(Number.NaN), 1);
});

test("E3.4 el visor pide la imagen de nuevo al abrirla, sin enlace ni descarga, y se adapta al teléfono", () => {
  const viewer = code("src/features/activityPhotos/FamilyPhotoViewer.tsx");
  assert.match(viewer, /getActivityPhotoImage\(organizationId, photoId, token\)/);
  assert.match(viewer, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.doesNotMatch(viewer, /download|<a\s|href=|navigator\.share|saveAs/i, "sin descarga ni compartir");
  assert.match(viewer, /env\(safe-area-inset-top\)/);
  assert.match(viewer, /h-11 w-11/, "botón de cerrar de 44 px");
  assert.match(viewer, /event\.key === "Escape"/);
  assert.match(viewer, /role="dialog" aria-modal="true"/);
  assert.match(viewer, /family-photo-gone/, "si ya no está disponible, lo dice");
  // No se promete impedir capturas de pantalla.
  const texts = JSON.stringify(es.family) + JSON.stringify(en.family);
  assert.doesNotMatch(texts, /captura|screenshot|no se puede copiar|cannot be copied|protegid|protected/i);
});

test("E3.5 nada de las fotos queda en el teléfono ni en el modo sin señal", () => {
  for (const f of ["src/features/activityPhotos/FamilyPhotoViewer.tsx", "src/features/activityPhotos/FamilyPhotos.tsx", "src/features/activityPhotos/useFamilyPhotoViewer.tsx", "src/features/activityPhotos/familyPhotos.ts"]) {
    assert.doesNotMatch(code(f), /localStorage|sessionStorage|indexedDB|secureSet|caches\./, f);
  }
  const readable = new RegExp(read("src/api/client.ts").match(/const OFFLINE_READABLE=\/(.+?)\/;/)[1]);
  assert.equal(readable.test("/organizations/o/activity-photos/p/image"), false);
  assert.equal(readable.test("/organizations/o/care-recipients/r/timeline?limit=50"), false);
});

test("E3.6 con ACTIVITY_PHOTOS apagado las tres pantallas no cambian", () => {
  for (const f of ["src/pages/family/FamilyTodayPage.tsx", "src/pages/family/FamilySupportPages.tsx", "src/pages/family/FamilyHistoryPage.tsx"]) {
    assert.match(code(f), /const photosOn = hasOrgFeature\(activeOrganization\?\.features, "ACTIVITY_PHOTOS"\);/, f);
  }
  assert.match(code("src/pages/family/FamilyTodayPage.tsx"), /\{photosOn && recipient && \(/);
  assert.match(code("src/pages/family/FamilySupportPages.tsx"), /photosOn \? familyPhotos\(todayItems\) : \[\]/);
  assert.match(code("src/pages/family/FamilyHistoryPage.tsx"), /\{photosOn && organizationId && \(/);
});

test("E3.7 «Hoy», «Actividad» e «Historial» usan la misma actualización (30 s, 10 s con visor, al volver)", () => {
  for (const f of ["src/pages/family/FamilyTodayPage.tsx", "src/pages/family/FamilySupportPages.tsx", "src/pages/family/FamilyHistoryPage.tsx"]) {
    const src = code(f);
    assert.match(src, /useFamilyRefresh\(load\);/, f);
    assert.doesNotMatch(src, /setInterval/, `${f}: sin intervalos propios`);
  }
});

test("E3.8 estados claros sin fotos, en español e inglés", () => {
  assert.match(es.family.noneToday, /Todavía no hay fotos compartidas hoy/);
  assert.match(en.family.noneToday, /No photos shared today/);
  assert.ok(es.family.noneShift && en.family.noneShift && es.family.gone && en.family.gone);
});

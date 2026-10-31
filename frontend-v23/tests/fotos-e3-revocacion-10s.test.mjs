// Mejora de revocación (31-oct-2026): con el visor abierto, una foto retirada o con el consentimiento
// revocado deja de verse en ≤ 10 s (antes ≤ 30 s), sin pedir la imagen otra vez y sin pedir nada con la app oculta.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isViewerOpen, markViewerOpen, PAGE_REFRESH_MS, refreshInterval, requestsPerMinute, RETURN_DEDUPE_MS,
  shouldRefreshOnReturn, subscribeViewer, VIEWER_REFRESH_MS,
} from "../src/features/activityPhotos/familyRefresh.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("R1 ventana: 10 s con el visor abierto; 30 s sin visor (sin cambio)", () => {
  assert.equal(VIEWER_REFRESH_MS, 10_000);
  assert.equal(PAGE_REFRESH_MS, 30_000);
  assert.equal(refreshInterval(true), 10_000);
  assert.equal(refreshInterval(false), 30_000);
});

test("R2 solicitudes acotadas: 2/min sin visor (como antes) y 6/min solo mientras el visor está abierto", () => {
  assert.equal(requestsPerMinute(false), 2);
  assert.equal(requestsPerMinute(true), 6);
});

test("R3 el visor marca su presencia y la libera al cerrarse (también con varios abiertos)", () => {
  const seen = [];
  const off = subscribeViewer(() => seen.push(isViewerOpen()));
  assert.equal(isViewerOpen(), false);
  const closeA = markViewerOpen();
  const closeB = markViewerOpen();
  assert.equal(isViewerOpen(), true);
  closeA();
  assert.equal(isViewerOpen(), true);
  closeB();
  closeB(); // cerrar dos veces no deja el contador en negativo
  assert.equal(isViewerOpen(), false);
  off();
  assert.deepEqual(seen, [true, true, true, false, false]);
});

test("R4 al volver a la app se actualiza una sola vez aunque lleguen focus y visibilitychange", () => {
  assert.equal(RETURN_DEDUPE_MS, 2_000);
  assert.equal(shouldRefreshOnReturn(10_000, 10_500), false);
  assert.equal(shouldRefreshOnReturn(10_000, 12_000), true);
  assert.equal(shouldRefreshOnReturn(0, 5), false);
});

test("R5 el hook: nada con la app oculta, vuelve con focus o visibilitychange, intervalo según el visor", () => {
  const hook = code("src/features/activityPhotos/useFamilyRefresh.ts");
  assert.match(hook, /useSyncExternalStore\(subscribeViewer, isViewerOpen, \(\) => false\)/);
  assert.match(hook, /if \(document\.visibilityState !== "hidden"\) run\(\);\s*\}, refreshInterval\(viewerOpen\)\)/);
  assert.match(hook, /addEventListener\("visibilitychange", onReturn\)/);
  assert.match(hook, /addEventListener\("focus", onReturn\)/);
  assert.match(hook, /shouldRefreshOnReturn\(lastLoadAt\.current, Date\.now\(\)\)/);
  assert.match(hook, /removeEventListener\("visibilitychange", onReturn\)/);
  // Solo se recarga la línea de tiempo: el hook no pide imágenes.
  assert.doesNotMatch(hook, /getActivityPhotoImage|\/image/);
});

test("R6 el visor se registra al abrirse y el cierre por revocación sigue igual", () => {
  const viewer = code("src/features/activityPhotos/FamilyPhotoViewer.tsx");
  assert.match(viewer, /useEffect\(\(\) => markViewerOpen\(\), \[\]\);/);
  const hook = code("src/features/activityPhotos/useFamilyPhotoViewer.tsx");
  assert.match(hook, /const gone = openId !== null && !stillShared\(photos, openId\);/);
});

// Fotos de actividades E1 (31-oct-2026): Portal del Cuidador.
// La foto vive solo en memoria (nunca en el teléfono ni en la cola cifrada), sin conexión se
// avisa que necesita internet, y con ACTIVITY_PHOTOS apagado la pantalla no cambia.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fitInside, MAX_EDGE, preparePhoto, PhotoPrepareError } from "../src/features/activityPhotos/preparePhoto.ts";
import { isRetryablePhotoError, photoErrorKey } from "../src/features/activityPhotos/photoErrors.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const es = JSON.parse(read("src/i18n/locales/es/photos.json"));
const en = JSON.parse(read("src/i18n/locales/en/photos.json"));
const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

test("E1.1 la foto se reduce a 2048 px como máximo y nunca se agranda", () => {
  assert.equal(MAX_EDGE, 2048);
  assert.deepEqual(fitInside(8064, 6048), { width: 2048, height: 1536 }); // 48 MP de iPhone
  assert.deepEqual(fitInside(3024, 4032), { width: 1536, height: 2048 }); // vertical
  assert.deepEqual(fitInside(800, 600), { width: 800, height: 600 });
});

test("E1.2 un archivo que no es imagen se rechaza en el teléfono", async () => {
  await assert.rejects(preparePhoto(new File(["%PDF-1.4"], "receta.pdf", { type: "application/pdf" })),
    (e) => e instanceof PhotoPrepareError && e.message === "PHOTO_NOT_IMAGE");
});

test("E1.3 si el teléfono no puede leerla (HEIC en Android), va tal cual para que el servidor la convierta, con límite de tamaño", async () => {
  const heic = await preparePhoto(new File([new Uint8Array(1024)], "IMG_0001.HEIC", { type: "" }));
  assert.equal(heic.reencoded, false);
  assert.equal(heic.contentType, "image/heic");
  await assert.rejects(preparePhoto(new File([new Uint8Array(16 * 1024 * 1024)], "big.heic", { type: "image/heic" })),
    (e) => e instanceof PhotoPrepareError && e.message === "PHOTO_TOO_LARGE");
});

test("E1.4 cada error del servidor tiene un mensaje claro en español e inglés", () => {
  const cases = [
    [{ status: 0, isNetworkError: true }, "errors.offline"],
    [{ status: 409, code: "PHOTO_CONSENT_REQUIRED" }, "errors.consentRequired"],
    [{ status: 409, code: "PHOTO_ALREADY_ATTACHED" }, "errors.alreadyAttached"],
    [{ status: 413 }, "errors.tooLarge"],
    [{ status: 503, code: "PHOTO_BUSY" }, "errors.busy"],
    [{ status: 503, code: "PHOTO_STORAGE_NOT_CONFIGURED" }, "errors.unavailable"],
    [{ status: 415, code: "PHOTO_UNSUPPORTED_TYPE" }, "errors.badImage"],
    [{ status: 422, code: "PHOTO_UNREADABLE" }, "errors.badImage"],
    [{ status: 404, code: "FEATURE_NOT_ENABLED" }, "errors.notAllowed"],
    [{ status: 500, errorId: "0f6c5a0e-1111-4111-8111-111111111111" }, "errors.withCode"],
    [{ status: 500 }, "errors.generic"],
  ];
  for (const [error, key] of cases) {
    assert.equal(photoErrorKey(error).key, key, JSON.stringify(error));
    const [group, name] = key.split(".");
    assert.ok(es[group][name] && en[group][name], `${key} sin traducción`);
  }
  assert.equal(photoErrorKey({ status: 500, errorId: "0f6c5a0e-1111-4111-8111-111111111111" }).code, "0f6c5a0e");
  assert.ok(isRetryablePhotoError({ status: 0 }) && isRetryablePhotoError({ status: 503, code: "PHOTO_BUSY" }));
  assert.ok(!isRetryablePhotoError({ status: 409, code: "PHOTO_CONSENT_REQUIRED" }) && !isRetryablePhotoError({ status: 422 }));
});

test("E1.5 catálogo bilingüe completo, y el aviso sin conexión dice que la foto necesita internet", () => {
  assert.deepEqual(keys(en).sort(), keys(es).sort());
  assert.match(es.picker.offline, /necesitan internet/);
  assert.match(es.picker.offline, /no se guardan en el teléfono/);
  assert.match(es.caregiver.queuedPhotoDropped, /no se guardó/);
  assert.match(es.caregiver.retryBody, /se pierde si sales/);
  // Nunca se promete guardar la foto en el teléfono (eso es E6).
  for (const text of keys(es).map((k) => k.split(".").reduce((o, p) => o[p], es))) {
    assert.doesNotMatch(text, /foto[^.]*(se enviará (sola|cuando)|guardada en el teléfono|se guardó en el teléfono)/i, text);
  }
});

test("E1.6 la foto nunca se guarda en el teléfono: ni almacenamiento local ni cola cifrada", () => {
  for (const f of ["src/features/activityPhotos/PhotoPicker.tsx", "src/features/activityPhotos/ActivityPhotoThumb.tsx", "src/features/activityPhotos/preparePhoto.ts", "src/api/activityPhotos.ts"]) {
    assert.doesNotMatch(code(f), /localStorage|sessionStorage|indexedDB|secureSet|savePending|caches\./, f);
  }
  const queue = code("src/features/caregiver/CareEventQueueProvider.tsx");
  assert.doesNotMatch(queue, /photo|Blob/i, "la cola no conoce las fotos");
  const page = code("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.doesNotMatch(page, /secureSet|localStorage|savePending/);
  // Sin señal el registro va a la cola y la foto se descarta con aviso.
  assert.match(page, /outcome === "queued"[\s\S]{0,200}queuedPhotoDropped/);
});

test("E1.7 las rutas de fotos nunca se recuerdan para el modo sin señal ni se cachean", () => {
  const readable = new RegExp(read("src/api/client.ts").match(/const OFFLINE_READABLE=\/(.+?)\/;/)[1]);
  const org = "/organizations/o1";
  for (const path of [`${org}/shifts/s1/photo-eligibility`, `${org}/care-events/e1/photo`, `${org}/care-events/e1/photo-eligibility`, `${org}/activity-photos/p1/image`]) {
    assert.equal(readable.test(path), false, path);
  }
  assert.match(read("src/api/client.ts"), /async function getBinary[^]*?cache:"no-store"/);
  // 145: optional «?purpose=legal-review» (legal-review mode only); still getBinary (no-store).
  assert.match(code("src/api/activityPhotos.ts"), /getBinary\(`\/organizations\/\$\{organizationId\}\/activity-photos\/\$\{photoId\}\/image\$\{opts\.legalReview \? "\?purpose=legal-review" : ""\}`/);
});

test("E1.8 con ACTIVITY_PHOTOS apagado el turno no cambia: el selector y las fotos dependen del interruptor", () => {
  const page = code("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.match(page, /const photosOn = hasOrgFeature\(activeOrganization\?\.features, "ACTIVITY_PHOTOS"\)/);
  assert.match(page, /\{photosOn && <PhotoPicker /);
  assert.match(page, /\{photosOn && photoRetry && /);
  assert.match(page, /\{photosOn && organizationId && careEvents\.some/);
  assert.match(page, /if \(photosOn\) \{\s*\n\s*\/?\/?.*\n?\s*void Promise\.all\(eventRows/);
  assert.match(page, /const attached = photosOn \? photo : null;/);
  assert.match(page, /if \(!photosOn \|\| !activeAction/);
});

test("E1.9 cámara trasera y galería en iPhone y Android", () => {
  const picker = code("src/features/activityPhotos/PhotoPicker.tsx");
  assert.match(picker, /type="file" accept="image\/\*" capture="environment"/);
  assert.match(picker, /data-testid="activity-photo-gallery"/);
  const gallery = picker.match(/<input[^>]*activity-photo-gallery[^>]*>/)[0];
  assert.doesNotMatch(gallery, /capture/);
});

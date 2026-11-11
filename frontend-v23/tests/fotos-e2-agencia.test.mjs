// Fotos de actividades E2 (31-oct-2026): Portal de la Agencia.
// Solo administración y supervisión, solo con ACTIVITY_PHOTOS, decisiones con motivo y concurrencia
// optimista, consentimientos que nunca se editan, imágenes privadas sin almacenamiento local.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { agencyPhotoErrorKey } from "../src/features/activityPhotos/photoErrors.ts";
import { canReviewPhotos } from "../src/features/activityPhotos/permissions.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const es = JSON.parse(read("src/i18n/locales/es/photos.json"));
const en = JSON.parse(read("src/i18n/locales/en/photos.json"));
const get = (o, key) => key.split(".").reduce((v, k) => v?.[k], o);

test("E2.1 solo administración y supervisión revisan fotos (ni cuidadores, ni familia, ni ETNARA central)", () => {
  assert.equal(canReviewPhotos(["ORGANIZATION_ADMIN"]), true);
  assert.equal(canReviewPhotos(["SUPERVISOR"]), true);
  assert.equal(canReviewPhotos(["WORKER"]), false);
  assert.equal(canReviewPhotos(["FAMILY"]), false);
  assert.equal(canReviewPhotos(["PLATFORM_SUPERADMIN"]), false);
  assert.equal(canReviewPhotos([]), false);
  assert.equal(canReviewPhotos(undefined), false);
});

test("E2.2 cada error de revisión y de consentimiento tiene mensaje en español e inglés", () => {
  const cases = [
    [{ status: 0 }, "agencyErrors.offline"],
    [{ status: 409, code: "PHOTO_STATUS_CHANGED" }, "agencyErrors.statusChanged"],
    [{ status: 400, code: "PHOTO_REASON_REQUIRED" }, "agencyErrors.reasonRequired"],
    [{ status: 400, code: "PHOTO_CONSENT_REASON_REQUIRED" }, "agencyErrors.reasonRequired"],
    [{ status: 409, code: "PHOTO_CONSENT_REQUIRED" }, "agencyErrors.consentRequired"],
    [{ status: 409, code: "PHOTO_INVALID_TRANSITION" }, "agencyErrors.invalidTransition"],
    [{ status: 403, code: "PHOTO_REVIEW_MANAGER_ONLY" }, "agencyErrors.notAllowed"],
    [{ status: 403, code: "PHOTO_CONSENT_MANAGER_ONLY" }, "agencyErrors.notAllowed"],
    [{ status: 403, code: "ORGANIZATION_ACCESS_DENIED" }, "agencyErrors.notAllowed"],
    [{ status: 409, code: "PHOTO_CONSENT_ALREADY_ACTIVE" }, "agencyErrors.consentAlreadyActive"],
    [{ status: 400, code: "PHOTO_CONSENT_FORM_REQUIRED" }, "agencyErrors.formRequired"],
    [{ status: 415, code: "PHOTO_UNSUPPORTED_TYPE" }, "agencyErrors.formInvalid"],
    [{ status: 413 }, "agencyErrors.formTooLarge"],
    [{ status: 404, code: "NOT_FOUND" }, "agencyErrors.notFound"],
    [{ status: 500, errorId: "0f6c5a0e-1111-4111-8111-111111111111" }, "agencyErrors.withCode"],
    [{ status: 500 }, "agencyErrors.generic"],
  ];
  for (const [error, key] of cases) {
    assert.equal(agencyPhotoErrorKey(error).key, key, JSON.stringify(error));
    assert.ok(get(es, key) && get(en, key), `${key} sin traducción`);
  }
});

test("E2.3 la bandeja solo existe con ACTIVITY_PHOTOS y solo aparece en el menú de administración y supervisión", () => {
  // 145 (§5): la página decide con usePhotoMode (encendido + administración/supervisión, o modo de revisión legal).
  assert.match(read("src/App.tsx"), /<Route path="photos" element=\{<AgencyPhotoReviewPage\/>\}\/>/);
  const layout = code("src/layouts/AgencyLayout.tsx");
  assert.match(layout, /const photos = photoMode === "full" \|\| photoMode === "legal-review";/);
  assert.match(layout, /\(photos \|\| item\.to !== "\/agency\/photos"\)/);
  const page = code("src/pages/agency/AgencyPhotoReviewPage.tsx");
  assert.match(page, /const allowed = mode === "full" \|\| mode === "legal-review";/);
  assert.match(page, /if \(!allowed\) return <Navigate to="\/agency" replace \/>;/);
  assert.match(page, /if \(!organizationId \|\| !token \|\| !allowed\) return;/, "sin permiso no pide nada al backend");
});

test("E2.4 (v2) decisiones: motivo obligatorio (3+) para retirar y eliminar; 10+ para retenciones; se envía el estado visto (concurrencia)", () => {
  const page = code("src/pages/agency/AgencyPhotoReviewPage.tsx");
  assert.match(page, /const minReason = pending && \(isHold\(pending\.action\) \|\| isLegal\(pending\.action\)\) \? 10 : 3;/);
  assert.match(page, /const reasonOk = pending\?\.action === "showAgain" \|\| reason\.trim\(\)\.length >= minReason;/);
  assert.match(page, /disabled=\{!reasonOk \|\| !dateOk\}/);
  assert.match(page, /reviewAgencyPhoto\(organizationId, photo\.id, "WITHDRAW", photo\.status, token, reason\)/);
  assert.match(page, /agencyErrors\.statusChanged"[\s\S]{0,240}await load\(\)/, "si otra persona ya la cambió, se recarga");
  assert.match(page, /if \(mine !== requestId\.current\) return;\s*\n\s*setPhotos\(rows\);/);
  const api = code("src/api/activityPhotos.ts");
  assert.match(api, /\{ decision, expectedStatus, \.\.\.\(reason\?\.trim\(\) \? \{ reason: reason\.trim\(\) \} : \{\}\) \}/);
});

test("E2.5 (v2) sin aprobación manual: compartida → retirar; retirada que ya se compartió → volver a mostrar; nunca «compartir» una pendiente", () => {
  const page = code("src/pages/agency/AgencyPhotoReviewPage.tsx");
  assert.doesNotMatch(page, /"REJECT"/, "v2 no tiene «no compartir»");
  assert.doesNotMatch(page, /photo\.status === "pending" && <Button/, "una pendiente (solo agencia) no se aprueba a mano");
  assert.match(page, /photo\.status === "approved" && !photo\.expired && <Button[^>]*photo-withdraw/);
  assert.match(page, /\(photo\.status === "withdrawn" \|\| photo\.status === "rejected"\) && photo\.sharedAt && !photo\.expired/);
  assert.match(page, /const TABS: Tab\[\] = \["approved", "pending", "withdrawn", "deleted"\];/);
});

test("E2.6 consentimientos: solo se registran (con formulario) y se revocan con motivo; nunca se editan ni borran", () => {
  const card = code("src/features/activityPhotos/PhotoConsentCard.tsx");
  const api = code("src/api/activityPhotos.ts");
  assert.doesNotMatch(api, /photo-consents\/[^`]*`,[^)]*\b(put|patch|delete)\b|apiClient\.(put|patch|delete)\(`[^`]*photo-consents/);
  assert.match(card, /disabled=\{!form\}/, "sin formulario no se registra");
  assert.match(card, /disabled=\{reason\.trim\(\)\.length < 3\}/);
  assert.match(es.consents.recordNote, /No se edita ni borra/);
  // El formulario se abre como Blob privado, nunca como enlace del almacenamiento.
  assert.match(card, /getPhotoConsentForm\(organizationId, consent\.id, token\)[\s\S]{0,80}URL\.createObjectURL/);
  const profile = code("src/pages/agency/AgencyResidentProfilePage.tsx");
  assert.match(profile, /const photoConsents = hasOrgFeature\(activeOrganization\?\.features, "ACTIVITY_PHOTOS"\) && canReviewPhotos\(roles\);/);
  assert.match(profile, /photoConsents && <PhotoConsentCard /);
});

test("E2.7 imágenes y formularios privados: nunca en el almacenamiento del navegador; carga diferida", () => {
  for (const f of ["src/features/activityPhotos/PrivateImage.tsx", "src/features/activityPhotos/PhotoConsentCard.tsx", "src/features/activityPhotos/PhotoHistory.tsx", "src/pages/agency/AgencyPhotoReviewPage.tsx"]) {
    assert.doesNotMatch(code(f), /localStorage|sessionStorage|indexedDB|secureSet|caches\./, f);
  }
  const img = code("src/features/activityPhotos/PrivateImage.tsx");
  assert.match(img, /new IntersectionObserver/);
  assert.match(img, /URL\.revokeObjectURL\(objectUrl\)/);
  const readable = new RegExp(read("src/api/client.ts").match(/const OFFLINE_READABLE=\/(.+?)\/;/)[1]);
  for (const path of ["/organizations/o/activity-photos", "/organizations/o/activity-photos/p/history", "/organizations/o/care-recipients/r/photo-consents", "/organizations/o/photo-consents/c/form"]) {
    assert.equal(readable.test(path), false, path);
  }
});

test("E2.8 ETNARA central: el interruptor tiene nombre legible y deja claro que no ve fotos ni consentimientos", () => {
  const card = code("src/features/platform/OrganizationFeaturesCard.tsx");
  assert.match(card, /ACTIVITY_PHOTOS: \{ title: "Fotos de actividades", detail: "[^"]*no ve las fotos ni los consentimientos\." \}/);
  assert.match(card, /const ORDER: PilotFeatureCode\[\] = \[[^\]]*"ACTIVITY_PHOTOS"\]/);
  assert.match(read("src/api/platformOrganizations.ts"), /export type PilotFeatureCode = [^;]*"ACTIVITY_PHOTOS";/);
});

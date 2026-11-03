// Fotos v2 — endurecimiento de seguridad (backend 145, 3-nov-2026).
// M1: la cuidadora recibe un único código para cualquier retención. §5: con el módulo apagado, la
// administración entra en un modo de solo revisión legal. §6: la supervisión no ve base ni referencia.
// §4: avisos de agencia sin administración (supervisión y ETNARA central). Central: aviso al apagar.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { photoErrorKey } from "../src/features/activityPhotos/photoErrors.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const es = JSON.parse(read("src/i18n/locales/es/photos.json"));
const en = JSON.parse(read("src/i18n/locales/en/photos.json"));

test("M1: PHOTO_KEPT_BY_AGENCY (y los códigos anteriores) → «La agencia conserva esta foto»; nunca se distingue el tipo", () => {
  for (const code of ["PHOTO_KEPT_BY_AGENCY", "PHOTO_ON_HOLD", "PHOTO_ON_LEGAL_HOLD"]) {
    assert.deepEqual(photoErrorKey({ status: 409, code }), { key: "errors.kept" });
  }
  assert.doesNotMatch(es.errors.kept + en.errors.kept, /legal/i);
});

test("§5 modo: se pregunta al backend solo con el módulo apagado y siendo administración; encendido no hay petición", () => {
  const hook = code("src/features/activityPhotos/usePhotoMode.ts");
  assert.match(hook, /on \? \(canReviewPhotos\(roles\) \? "full" : "off"\) : canManageLegalHolds\(roles\) \? null : "off"/);
  assert.match(hook, /getAgencyPhotoMode\(organizationId, token\)/);
  assert.match(code("src/api/activityPhotos.ts"), /\/activity-photos\/mode`/);
  const layout = code("src/layouts/AgencyLayout.tsx");
  assert.match(layout, /const photos = photoMode === "full" \|\| photoMode === "legal-review";/);
  assert.match(code("src/App.tsx"), /<Route path="photos" element=\{<AgencyPhotoReviewPage\/>\}\/>/, "la página decide (ya no FeatureRoute)");
});

test("§5 página en modo legal: sin pestañas ni acciones ordinarias; solo revisar o levantar; la imagen solo a petición", () => {
  const page = code("src/pages/agency/AgencyPhotoReviewPage.tsx");
  assert.match(page, /if \(!allowed\) return <Navigate to="\/agency" replace \/>/);
  assert.match(page, /legalReview: legalOverdue \? "overdue" : "active"/);
  assert.match(page, /\{!legalMode && <div role="tablist"/);
  assert.match(page, /legal-review-mode/);
  assert.match(page, /!deleted && legalMode && legalAllowed && legal && \([\s\S]{0,400}photo-legal-review[\s\S]{0,300}photo-legal-release/);
  assert.match(page, /!deleted && !legalMode && \(/, "retirar, retener, eliminar y nueva retención legal solo con el módulo encendido");
  assert.match(page, /photo\.viewable && legalMode && !revealed\.has\(photo\.id\)[\s\S]{0,600}legal-view-image/);
  for (const k of ["legalModeTitle", "legalModeBody", "legalModeAll", "legalModeEmpty", "legalViewNote", "legalViewImage", "legalBasisHidden"]) {
    assert.ok(es.review[k] && en.review[k], k);
  }
  assert.match(es.review.legalModeBody, /queda registrado/);
  assert.match(es.review.legalViewNote, /queda registrado/);
});

test("§6: la supervisión no recibe base ni referencia; la tarjeta lo dice sin inventarla", () => {
  const api = code("src/api/activityPhotos.ts");
  assert.match(api, /legalHold: \{ basis\?: string \| null; reference\?: string \| null; placedAt: string; reviewAt: string; reviewOverdue: boolean; by\?: string \| null \} \| null/);
  const page = code("src/pages/agency/AgencyPhotoReviewPage.tsx");
  assert.match(page, /legal\.basis \? <><br \/>\{legal\.basis\}<\/> : <><br \/><span data-testid="photo-legal-basis-hidden">\{t\("review\.legalBasisHidden"\)\}/);
});

test("§4: campana — Central abre Organizaciones; la supervisión solo lo lee; Central tiene campana en su cabecera", () => {
  const bell = code("src/features/notifications/NotificationBell.tsx");
  assert.match(bell, /type === "PLATFORM_AGENCY_NO_ACTIVE_ADMIN"\) \{ navigate\("\/platform\/organizations"\); return; \}/);
  assert.match(bell, /type === "AGENCY_NO_ACTIVE_ADMIN"\) return;/);
  assert.match(code("src/layouts/PlatformLayout.tsx"), /<NotificationBell onDark \/>/);
});

test("§5 Central: advertencia (sí/no) al apagar fotos con retenciones legales; apagar nunca se bloquea", () => {
  const card = code("src/features/platform/OrganizationFeaturesCard.tsx");
  assert.match(card, /editing\.code === "ACTIVITY_PHOTOS" && !editing\.enabled && data\?\.activityPhotosLegalHolds && \(/);
  assert.match(card, /photos-legal-holds-warning/);
  assert.match(card, /se conservan, no se eliminan/);
  assert.doesNotMatch(card, /blocked = f\.code === "ACTIVITY_PHOTOS"/, "el interruptor de fotos no se deshabilita");
  assert.match(code("src/api/platformOrganizations.ts"), /activityPhotosLegalHolds\?: boolean;/);
});

// Fotos de actividades v2 (2-nov-2026): V3 familia, V4 agencia, V5 cuidadora.
// Sin aprobación manual: la foto se comparte al enviarse si hay consentimiento y el familiar lo autorizó
// (sin retroactividad). La agencia retira, elimina y retiene; la retención legal es solo de la administración.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { familyPhotos } from "../src/features/activityPhotos/familyPhotos.ts";
import { agencyPhotoErrorKey } from "../src/features/activityPhotos/photoErrors.ts";
import { canManageLegalHolds, canReviewPhotos } from "../src/features/activityPhotos/permissions.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const es = JSON.parse(read("src/i18n/locales/es/photos.json"));
const en = JSON.parse(read("src/i18n/locales/en/photos.json"));
const get = (o, k) => k.split(".").reduce((a, p) => a?.[p], o);

test("V3.1 autorización del familiar: empieza sin fotos, no pide imágenes hasta aceptar y explica que no es retroactiva", () => {
  const today = code("src/pages/family/FamilyTodayPage.tsx");
  assert.match(today, /photosOn && photoReceipt\.accepted \? familyPhotos\(/, "sin aceptar, la lista de fotos queda vacía");
  assert.match(today, /\{photoReceipt\.accepted && \(todayPhotos\.length/);
  const card = code("src/features/activityPhotos/PhotoReceiptCard.tsx");
  assert.match(card, /state === "not_answered"[\s\S]*photo-receipt-accept[\s\S]*photo-receipt-decline/);
  assert.match(card, /state === "accepted"[\s\S]*photo-receipt-stop/);
  assert.match(card, /state === "declined"[\s\S]*photo-receipt-start/);
  assert.doesNotMatch(card, /getActivityPhotoImage/, "la tarjeta nunca pide imágenes");
  assert.match(es.family.receipt.body2, /desde que aceptes, no las anteriores/);
  assert.match(en.family.receipt.body2, /after you accept, not earlier/);
  const hook = code("src/features/activityPhotos/usePhotoReceipt.ts");
  assert.match(hook, /setPhotoReceipt\(organizationId, careRecipientId, decision, token\)/);
  const api = code("src/api/activityPhotos.ts");
  assert.match(api, /\{ decision, textVersion: PHOTO_RECEIPT_TEXT_VERSION \}/, "se guarda la versión del texto aceptado");
});

test("V3.2 «Disponible hasta» visible en la miniatura y en el visor", () => {
  const photos = familyPhotos([{ id: "a", type: "MEAL", occurredAt: "2026-11-02T16:00:00Z", title: "Comida", summary: "", caregiver: { displayName: null, role: null },
    photo: { visible: true, reference: "p1", availableUntil: "2026-12-02T16:00:00Z" } }]);
  assert.equal(photos[0].availableUntil, "2026-12-02T16:00:00Z");
  assert.match(code("src/features/activityPhotos/FamilyPhotos.tsx"), /photo\.availableUntil && [\s\S]{0,140}family-photo-available-until/);
  assert.match(code("src/features/activityPhotos/FamilyPhotoViewer.tsx"), /family-viewer-available-until/);
  assert.ok(es.family.availableUntil.includes("{{date}}") && en.family.availableUntil.includes("{{date}}"));
});

test("V3.3 la agencia ve quién recibe fotos, pero no puede aceptar por el familiar", () => {
  const card = code("src/features/activityPhotos/PhotoRecipientsCard.tsx");
  assert.match(card, /listPhotoRecipients\(/);
  assert.doesNotMatch(card, /setPhotoReceipt|apiClient\.(put|post|patch|delete)/);
  assert.match(code("src/pages/agency/AgencyResidentProfilePage.tsx"), /photoConsents && <PhotoRecipientsCard /);
});

test("V4.1 historial administrativo: retirar, volver a mostrar, eliminar y retener; todo con motivo y con historial", () => {
  const page = code("src/pages/agency/AgencyPhotoReviewPage.tsx");
  assert.match(page, /deleteActivityPhoto\(organizationId, photo\.id, token, reason\)/);
  assert.match(page, /holdAgencyPhoto\(organizationId, photo\.id, token, \{ action: action === "holdPlace" \? "PLACE" : "RENEW"/);
  assert.match(page, /legalHoldAgencyPhoto\(organizationId, photo\.id, token,/);
  assert.match(page, /<PhotoHistory organizationId=\{organizationId\} photoId=\{photo\.id\}/);
  // Con retención (ordinaria o legal) no se ofrece eliminar; el backend también lo impide.
  assert.match(page, /\{!held && !legal && <Button[^>]*photo-delete/);
  // La imagen solo se pide si sigue visible; si no, una lápida sin imagen.
  assert.match(page, /\{photo\.viewable \? \(\s*<PrivateImage/);
  assert.match(page, /agency-photo-tombstone/);
  // Fecha de revisión: entre mañana y 90 días.
  assert.match(page, /at > now && at <= now \+ 90 \* 86_400_000/);
});

test("V4.2 retención legal: solo la administración; avisa si la revisión está vencida", () => {
  assert.equal(canManageLegalHolds(["ORGANIZATION_ADMIN"]), true);
  assert.equal(canManageLegalHolds(["SUPERVISOR"]), false);
  assert.equal(canManageLegalHolds(undefined), false);
  assert.equal(canReviewPhotos(["SUPERVISOR"]), true);
  const page = code("src/pages/agency/AgencyPhotoReviewPage.tsx");
  assert.match(page, /\{legalAllowed && !legal && <Button/);
  assert.match(page, /legal\.reviewOverdue && <>/);
});

test("V4.3 cada error nuevo del backend tiene mensaje en español e inglés", () => {
  const cases = {
    PHOTO_ON_HOLD: "agencyErrors.onHold", PHOTO_ON_LEGAL_HOLD: "agencyErrors.onLegalHold", PHOTO_HOLD_LIMIT: "agencyErrors.holdLimit",
    PHOTO_EXPIRED: "agencyErrors.expired", PHOTO_ALREADY_DELETED: "agencyErrors.alreadyDeleted", PHOTO_LEGAL_HOLD_ADMIN_ONLY: "agencyErrors.legalAdminOnly",
  };
  for (const [codeName, key] of Object.entries(cases)) {
    const got = agencyPhotoErrorKey({ status: 409, code: codeName }).key;
    assert.equal(got, key, codeName);
    assert.ok(get(es, key) && get(en, key), `${key} sin traducción`);
  }
});

test("V5 cuidadora: envío directo, aviso de si se compartió, «Quitar foto» y sin galería propia", () => {
  const thumb = code("src/features/activityPhotos/ActivityPhotoThumb.tsx");
  assert.match(thumb, /deleteActivityPhoto\(organizationId, photo\.id, token\)/);
  assert.match(thumb, /activity-photo-remove-confirm/);
  assert.match(thumb, /URL\.revokeObjectURL/);
  assert.doesNotMatch(thumb, /localStorage|sessionStorage|indexedDB|download=/);
  const shift = code("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.match(shift, /savedShared|photoSentShared/);
  assert.match(shift, /savedAgencyOnly|photoSentAgencyOnly/);
  assert.match(es.caregiver.windowNote, /\S/);
  assert.match(en.caregiver.windowNote, /\S/);
  // No hay pantalla de «mis fotos»: las fotos solo aparecen dentro del registro de la visita.
  assert.doesNotMatch(read("src/App.tsx"), /caregiver\/photos/);
});

test("V4.4 tocar la pestaña activa no deja la lista cargando para siempre", () => {
  const page = code("src/pages/agency/AgencyPhotoReviewPage.tsx");
  assert.match(page, /function chooseTab\(next: Tab\) \{\s*\n\s*if \(next === tab && !legalOverdue\) return;/);
});

test("D1 cuidadora: si la agencia conserva la foto no se ofrece «Quitar foto», se explica sin dar el motivo, y el rechazo del backend tiene mensaje propio", async () => {
  const thumb = code("src/features/activityPhotos/ActivityPhotoThumb.tsx");
  assert.match(thumb, /\{photo\.keptByAgency && <span[^>]*data-testid="activity-photo-kept"/);
  assert.match(thumb, /\{photo\.canRemove !== false && !photo\.keptByAgency && onRemoved && \(/);
  assert.match(thumb, /activity-photo-remove-confirm/, "la confirmación sigue antes de quitar");
  const { photoErrorKey } = await import("../src/features/activityPhotos/photoErrors.ts");
  for (const c of ["PHOTO_ON_HOLD", "PHOTO_ON_LEGAL_HOLD"]) assert.equal(photoErrorKey({ status: 409, code: c }).key, "errors.kept");
  for (const lang of [es, en]) {
    assert.ok(lang.caregiver.kept && lang.errors.kept);
    assert.doesNotMatch(lang.caregiver.kept + lang.errors.kept, /legal|judicial|motivo|reason/i, "nunca el motivo ni el tipo de retención");
  }
});

test("D2 la notificación diaria abre solo las retenciones legales vencidas de la agencia", () => {
  const bell = code("src/features/notifications/NotificationBell.tsx");
  assert.match(bell, /type === "PHOTO_LEGAL_HOLD_REVIEW_OVERDUE" && portal === "agency"\) \{\s*navigate\("\/agency\/photos\?legal=overdue"\);/);
  const page = code("src/pages/agency/AgencyPhotoReviewPage.tsx");
  assert.match(page, /const legalOverdue = searchParams\.get\("legal"\) === "overdue";/);
  assert.match(page, /listAgencyPhotos\(organizationId, token, \{ legalReview: "overdue", limit \}\)/);
  assert.match(page, /data-testid="legal-overdue-view"/);
  assert.match(page, /legalAllowed \? "review\.legalOverdueBody" : "review\.legalOverdueBodySupervisor"/);
  const api = code("src/api/activityPhotos.ts");
  assert.match(api, /if \(filter\.legalReview\) params\.set\("legalReview", filter\.legalReview\);/);
  for (const lang of [es, en]) for (const k of ["legalOverdueTitle", "legalOverdueBody", "legalOverdueBodySupervisor", "legalOverdueBack", "legalOverdueEmpty"]) assert.ok(lang.review[k], k);
  const notifications = code("src/api/notifications.ts");
  assert.match(notifications, /itemCount\?: number \| null;/);
  assert.match(notifications, /type === "PHOTO_LEGAL_HOLD_REVIEW_OVERDUE"\) return "/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../src/pages/caregiver/CaregiverShiftDetailPage.tsx");
const api = read("../src/api/activityPhotos.ts");
const client = read("../src/api/client.ts");
const picker = read("../src/features/activityPhotos/PhotoPicker.tsx");
const prepare = read("../src/features/activityPhotos/preparePhoto.ts");
const thumb = read("../src/features/activityPhotos/ActivityPhotoThumb.tsx");
const queue = read("../src/features/caregiver/CareEventQueueProvider.tsx");
const features = read("../src/auth/orgFeatures.tsx");

test("everything sits behind the agency's ACTIVITY_PHOTOS switch", () => {
  assert.match(features, /export type OrgFeature = "SMARTMATCH" \| "EN_CAMINO" \| "ACTIVITY_PHOTOS";/);
  assert.match(page, /const photosOn = hasOrgFeature\(activeOrganization\?\.features, "ACTIVITY_PHOTOS"\);/);
  assert.match(page, /\{photosOn && <PhotoPicker /);
  assert.match(page, /\{photosOn && photoRetry && \(/);
  assert.match(page, /\{photosOn && organizationId && Object\.keys\(eventPhotos\)\.length > 0 && \(/);
});

test("eligibility: only canAttach is read; 404 means no; asked each time a record sheet opens", () => {
  assert.match(api, /\/shifts\/\$\{shiftId\}\/photo-eligibility/);
  assert.match(api, /\/care-events\/\$\{careEventId\}\/photo-eligibility/);
  assert.match(api, /return result\.canAttach === true;/);
  assert.doesNotMatch(api, /photo-consents|signer|signed_form|recordedBy/);
  assert.match(page, /getShiftPhotoEligibility\(organizationId, shiftId, token\)/);
  assert.match(page, /\}, \[photosOn, activeAction, organizationId, shiftId\]\);/);
  // Not remembered for offline use: eligibility is never served from a stale copy.
  assert.doesNotMatch(client.match(/const OFFLINE_READABLE=([^;]+);/)[1], /eligibility|photo/);
});

test("blocked: both buttons disabled with a plain message; no file inputs", () => {
  assert.match(picker, /disabled=\{busy \|\| blocked\}/g);
  assert.equal((picker.match(/disabled=\{busy \|\| blocked\}/g) ?? []).length, 2);
  assert.match(picker, /No se pueden añadir fotos para esta persona\. Puedes guardar el registro sin foto\./);
  assert.match(picker, /\{!blocked && <>/);
});

test("camera and gallery work the same on iPhone and Android", () => {
  assert.match(picker, /type="file" accept="image\/\*" capture="environment"[^>]*data-testid="activity-photo-camera"/);
  assert.match(picker, /type="file" accept="image\/\*" className="hidden" data-testid="activity-photo-gallery"/);
  assert.match(picker, /Tomar foto/);
  assert.match(picker, /Elegir de la galería/);
  assert.match(picker, /aria-label="Quitar foto"/);
});

test("the phone redraws the photo as a JPEG ≤ 2048 px (EXIF dropped); unreadable files go to the server as is", () => {
  assert.match(prepare, /export const MAX_EDGE = 2048;/);
  assert.match(prepare, /createImageBitmap\(file, \{ imageOrientation: "from-image" \}\)/);
  assert.match(prepare, /canvas\.toBlob\(resolve, "image\/jpeg", JPEG_QUALITY\)/);
  assert.match(prepare, /const SERVER_TYPES = \["image\/jpeg", "image\/png", "image\/webp", "image\/heic", "image\/heif"\];/);
  assert.match(picker, /value\.reencoded\s+\? <img/);
  assert.match(picker, /Este teléfono no puede mostrar la vista previa\. Se convertirá al enviarla\./);
});

test("fitInside keeps the ratio and never enlarges", async () => {
  const { fitInside } = await import("../src/features/activityPhotos/preparePhoto.ts");
  assert.deepEqual(fitInside(4032, 3024), { width: 2048, height: 1536 });
  assert.deepEqual(fitInside(3024, 4032), { width: 1536, height: 2048 });
  assert.deepEqual(fitInside(800, 600), { width: 800, height: 600 });
});

test("photos never touch the phone's storage or the offline queue", () => {
  for (const source of [api, picker, prepare, thumb, page]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|secureSet/);
  }
  // The queued record carries only the care data, never the image.
  assert.match(page, /const input = \{ typeCode: activeAction, careRecipientId: shift\.care_recipient_id, \.\.\.carePayload\(\) \};/);
  assert.match(page, /La foto no se guardó: tómala de nuevo cuando tengas señal\./);
  assert.match(queue, /return \(await createCareEvent\(item\.organizationId, item\.shiftId, item\.input as CreateCareEventInput, token\)\)\.id;/);
});

test("images are private: token in the header, no cache, object URLs released", () => {
  assert.match(client, /async function getBlob\(path:string,token:string\):Promise<Blob>\{[^}]*headers:\{Authorization:`Bearer \$\{token\}`\},cache:"no-store"/);
  assert.match(thumb, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.match(picker, /useEffect\(\(\) => \(\) => \{ if \(previewUrl\) URL\.revokeObjectURL\(previewUrl\); \}, \[previewUrl\]\);/);
  assert.doesNotMatch(api + thumb + picker, /storage_key|storageKey|t3\.storageapi|presign/i);
});

test("upload confirmation and clear messages; the server's re-check wins", () => {
  assert.match(page, /Actividad guardada con foto\. La agencia la revisará antes de compartirla con la familia\./);
  assert.match(api, /PHOTO_CONSENT_REQUIRED"\) return "Esta persona ya no tiene consentimiento de fotografía\. La actividad se guardó sin foto\."/);
  assert.match(page, /La actividad se guardó, pero la foto no\. \$\{message\}/);
  // Retry only for temporary failures, and only after asking again.
  assert.match(page, /const retryable = \(photoError as ApiError\)\?\.status === 0 \|\| code === "PHOTO_BUSY"/);
  assert.match(page, /await getActivityPhotoEligibility\(organizationId, photoRetry\.eventId, token\)/);
});

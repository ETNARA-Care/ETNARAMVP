import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("caregiver sees credential review result labels", () => {
  const notifications = read("src/api/notifications.ts");
  assert.match(notifications, /CREDENTIAL_REVIEW_APPROVED/);
  assert.match(notifications, /Credencial aprobada/);
  assert.match(notifications, /CREDENTIAL_REVIEW_REJECTED/);
  assert.match(notifications, /Credencial rechazada/);
});

test("credential review result notification deep-links to caregiver credentials", () => {
  const bell = read("src/features/notifications/NotificationBell.tsx");
  assert.match(bell, /CREDENTIAL_REVIEW_APPROVED/);
  assert.match(bell, /CREDENTIAL_REVIEW_REJECTED/);
  assert.match(bell, /\/caregiver\/profile#my-credentials/);
});

test("caregiver profile exposes a stable credentials anchor and rejection reason", () => {
  const page = read("src/pages/caregiver/CaregiverSupportPages.tsx");
  assert.match(page, /id="my-credentials"/);
  assert.match(page, /Motivo del rechazo/);
  assert.match(page, /reviewNotes/);
  assert.match(page, /Reemplazar documento/);
});

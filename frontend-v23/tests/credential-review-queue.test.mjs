import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("agency compliance exposes tenant credential review queue", () => {
  const api = read("src/api/agencyCredentials.ts");
  const panel = read("src/pages/agency/CredentialReviewQueuePanel.tsx");
  const center = read("src/pages/agency/AgencyComplianceCenterPage.tsx");

  assert.match(api, /\/organizations\/\$\{organizationId\}\/credentials\/review-queue/);
  assert.match(panel, /listPendingCredentialReviews/);
  assert.match(panel, /reviewWorkerCredential/);
  assert.match(panel, /openCredentialDocument/);
  assert.match(center, /<CredentialReviewQueuePanel\/>/);
});

test("credential rejection requires notes and queue refreshes after review", () => {
  const panel = read("src/pages/agency/CredentialReviewQueuePanel.tsx");
  assert.match(panel, /status === "rejected" && !notes\.trim\(\)/);
  assert.match(panel, /Indica el motivo del rechazo/);
  assert.match(panel, /await load\(\)/);
  assert.match(panel, /Documento aprobado/);
  assert.match(panel, /Documento rechazado/);
});

test("credential review notification deep-links to compliance queue", () => {
  const notifications = read("src/api/notifications.ts");
  const bell = read("src/features/notifications/NotificationBell.tsx");

  assert.match(notifications, /CREDENTIAL_REVIEW_PENDING/);
  assert.match(notifications, /Credencial pendiente de revisión/);
  assert.match(bell, /CREDENTIAL_REVIEW_PENDING/);
  assert.match(bell, /\/agency\/compliance#credential-review-queue/);
});

// 159: mensajes claros al aceptar invitaciones de cuidador y aviso de acceso a documentos profesionales.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/pages/ActivateInvitationPage.tsx", import.meta.url), "utf8");

test("cada código del servidor tiene su mensaje; ninguno expone datos internos", () => {
  for (const code of ["INVITATION_IDENTITY_MISMATCH", "WORKER_ALREADY_IN_ORGANIZATION", "WORKER_PROFILE_CONFLICT", "WORKER_ALREADY_LINKED", "WORKER_NOT_ACTIVE", "ACCOUNT_DISABLED", "INVITATION_EXPIRED"]) {
    assert.match(page, new RegExp(`case "${code}"`));
  }
  assert.match(page, /setError\(activationErrorMessage\(\(caught as ApiError\)\.code\)\)/);
  assert.doesNotMatch(page, /workers_user_id_key|INTERNAL_ERROR/);
});

test("el aviso de documentos profesionales aparece solo en invitaciones de cuidador, antes de aceptar", () => {
  assert.match(page, /\{invitation\.invitation_type === "worker" && \(/);
  assert.match(page, /podrá ver tus credenciales y documentos profesionales mientras trabajes con esta organización/);
  assert.ok(page.indexOf('data-testid="professional-documents-notice"') < page.indexOf('type="submit"'));
});

test("el aviso no presenta los documentos como verificados ni certificados", () => {
  const notice = page.slice(page.indexOf("professional-documents-notice"), page.indexOf("</p>", page.indexOf("professional-documents-notice")));
  assert.doesNotMatch(notice, /verific|certific|aprob/i);
});

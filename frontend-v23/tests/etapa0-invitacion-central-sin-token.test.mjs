import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Etapa 0 (9-nov-2026): ETNARA Central nunca ve ni muestra el enlace de activación del administrador.
test("Central never shows or keeps the activation token, even when the email fails", () => {
  const page = read("src/pages/platform/PlatformOrganizationsPage.tsx");
  const api = read("src/api/platformOrganizations.ts");
  assert.doesNotMatch(page, /activationToken/);
  assert.doesNotMatch(page, /font-mono[^"]*">\{/); // the old box that printed the raw token
  assert.doesNotMatch(page, /\?token=|invite\/organization-admin/);
  assert.doesNotMatch(api, /activationToken/);
  // The invite call passes on only the invitation and a normalized delivery result.
  assert.match(api, /return \{ invitation: result\.invitation, emailDelivery: \{ status: result\.emailDelivery\.status/);
  assert.match(page, /data-ui="invite-delivery-failed"/);
  assert.match(page, /ETNARA Central no muestra el enlace de activación/);
});

test("Central sees invitation status and can resend (new link by email) or revoke", () => {
  const page = read("src/pages/platform/PlatformOrganizationsPage.tsx");
  const api = read("src/api/platformOrganizations.ts");
  assert.match(api, /\/admin-invitations\/\$\{encodeURIComponent\(invitationId\)\}\/resend/);
  assert.match(api, /\/admin-invitations\/\$\{encodeURIComponent\(invitationId\)\}\/revoke/);
  assert.match(api, /export async function listCentralAdminInvitations/);
  assert.match(page, /data-ui="central-admin-invitations"/);
  assert.match(page, /inv\.resendable && <Button[^>]*onClick=\{\(\) => void resendInvitation\(inv\)\}>Reenviar/);
  assert.match(page, /inv\.revocable && <Button[^>]*onClick=\{\(\) => void revokeInvitation\(inv\)\}>Revocar/);
  assert.match(page, /RESEND_LIMIT_REACHED/);
});

test("the invitee's activation page is unchanged (existing flow)", () => {
  const invitePage = read("src/pages/OrganizationAdminInvitationPage.tsx");
  assert.match(invitePage, /activateOrganizationAdminInvitation\(token, password\)/);
  assert.match(invitePage, /acceptOrganizationAdminInvitation/);
});

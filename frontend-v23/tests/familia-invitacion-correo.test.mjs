import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Family invitations travel by e-mail (backend migration 120). The agency never
// sees the family link; it gets a confirmation only when the provider accepted the
// e-mail, a clear error with a retry that does not duplicate the invitation, and a
// safe «Reenviar». The activation page lets a person switch away from another
// account that is already signed in on the device.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const api = read("src/api/accessInvitations.ts");
const panel = read("src/pages/agency/AccessInvitationPanel.tsx");
const activation = read("src/pages/ActivateInvitationPage.tsx");

test("api: family invitations are sent by e-mail and never return a link", () => {
  assert.match(api, /export async function sendFamilyInvitation\(organizationId: string, input: Omit<FamilyInput, "type">, token: string\)/);
  assert.match(api, /apiClient\.post<FamilyInvitationSent>\(\s*`\/organizations\/\$\{organizationId\}\/access-invitations`, \{ type: "family", \.\.\.input \}, token,/);
  assert.match(api, /export interface FamilyInvitationSent \{ invitation: AccessInvitation; emailDelivery: \{ status: "sent" \}; resent: boolean \}/);
  const familyApi = api.slice(api.indexOf("export interface FamilyInvitationSent"), api.indexOf("export async function listAccessInvitations"));
  assert.doesNotMatch(familyApi, /token: string \}/, "no token in family responses");
  assert.match(api, /`\/organizations\/\$\{organizationId\}\/access-invitations\/\$\{invitationId\}\/resend`/);
});

test("api: a 2xx is not enough — confirmation requires an explicit emailDelivery «sent»", () => {
  assert.match(api, /function requireSent\(result: FamilyInvitationSent \| null\): FamilyInvitationSent \{\s*if \(result\?\.emailDelivery\?\.status !== "sent"\) throw \{ status: 0, code: "EMAIL_NOT_CONFIRMED" \}/);
  assert.match(api, /return requireSent\(await apiClient\.post<FamilyInvitationSent>\(\s*`\/organizations\/\$\{organizationId\}\/access-invitations`/);
  assert.match(api, /return requireSent\(await apiClient\.post<FamilyInvitationSent>\(\s*`\/organizations\/\$\{organizationId\}\/access-invitations\/\$\{invitationId\}\/resend`/);
  assert.match(panel, /code === "EMAIL_NOT_CONFIRMED"/);
});

test("api: staff (worker) invitations keep their shared link", () => {
  assert.match(api, /export async function createAccessInvitation\(organizationId: string, input: WorkerInput, token: string\)/);
  assert.match(api, /apiClient\.post<\{ invitation: AccessInvitation; token: string \}>/);
});

test("panel: confirmation only after the provider accepted; error keeps the form for a retry", () => {
  const familyStart = panel.indexOf('if (props.type === "family") {');
  const family = panel.slice(familyStart, panel.indexOf("      return;\n    }", familyStart));
  assert.match(family, /await sendFamilyInvitation\(/);
  assert.match(family, /toast\.show\(`Invitación enviada a \$\{address\}\.`, "success"\);/);
  assert.ok(family.indexOf("await sendFamilyInvitation(") < family.indexOf("Invitación enviada a"), "toast after the send resolves");
  assert.match(family, /setSendError\(familySendError\(error\)\);/);
  assert.doesNotMatch(family, /setSecureLink|buildActivationLink/, "no link for family invitations");
  assert.match(panel, /sendError \? "Reintentar envío" : "Enviar invitación"/);
  assert.match(panel, /role="alert" data-ui="invitation-send-error"/);
});

test("panel: clear messages for provider failure, missing configuration and the one-minute limit", () => {
  for (const code of ["RESEND_TOO_SOON", "EMAIL_NOT_CONFIGURED", "INVITATION_EMAIL_FAILED", "INVITATION_NOT_RESENDABLE"]) assert.match(panel, new RegExp(`code === "${code}"`));
  assert.match(panel, /La invitación quedó pendiente y no se duplicará/);
});

test("panel: «Reenviar» for family, «Nuevo enlace» stays for staff; e-mail status visible", () => {
  assert.match(panel, /props\.type === "family"\s*\? <Button variant="secondary" icon=\{<Send size=\{16\} \/>\} loading=\{resendingId === invitation\.id\}/);
  assert.match(panel, /: <Button variant="secondary" icon=\{<RotateCw size=\{16\} \/>\} onClick=\{\(\) => void renew\(invitation\.id\)\}>Nuevo enlace<\/Button>/);
  assert.match(panel, /await resendFamilyInvitation\(props\.organizationId, invitation\.id, token\);/);
  assert.match(panel, /data-ui="invitation-email-sent"/);
  assert.match(panel, /data-ui="invitation-email-missing"/);
});

test("activation: another signed-in account can be switched without consuming the invitation", () => {
  assert.match(activation, /const signedInAs = auth\.status === "authenticated"/);
  assert.match(activation, /const switchToAnotherAccount = async \(\) => \{/);
  assert.match(activation, /try \{ await auth\.logout\(\); setError\(null\); setPassword\(""\); \}/);
  assert.match(activation, /\{invitation\.account_exists && signedInAs && \(/);
  assert.match(activation, />Usar otra cuenta<\/Button>/);
  assert.match(activation, /if \(!invitation\?\.account_exists && auth\.status === "authenticated"\) await auth\.logout\(\);/);
});

test("activation: the token is still read from the URL fragment and removed from the address bar", () => {
  assert.match(activation, /new URLSearchParams\(window\.location\.hash\.slice\(1\)\)\.get\("token"\)/);
  assert.match(activation, /window\.history\.replaceState\(null, "", `\$\{window\.location\.pathname\}\$\{window\.location\.search\}`\)/);
});

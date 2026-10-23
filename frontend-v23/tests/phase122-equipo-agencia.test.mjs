import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("team API uses the shared client and the 12.2 routes", () => {
  const api = read("src/api/team.ts");
  assert.match(api, /from "\.\/client"/);
  assert.match(api, /\/organizations\/\$\{organizationId\}\/team`/);
  assert.match(api, /\/team\/invitations`/);
  assert.match(api, /\/team\/invitations\/\$\{invitationId\}\/revoke`/);
  assert.match(api, /invite\/organization-admin`/);
  assert.doesNotMatch(api, /localStorage|sessionStorage|mock/i);
});

test("only administrators see the team section", () => {
  const settings = read("src/pages/agency/AgencyOrganizationSettingsPage.tsx");
  assert.match(settings, /const isOrgAdmin = roles\.includes\("ORGANIZATION_ADMIN"\)/);
  assert.match(settings, /\{isOrgAdmin && organizationId && <TeamPanel organizationId=\{organizationId\} \/>\}/);
  const panel = read("src/features/agency/TeamPanel.tsx");
  assert.match(panel, /<option value="SUPERVISOR">Supervisor<\/option>/);
  assert.match(panel, /<option value="ORGANIZATION_ADMIN">Administrador<\/option>/);
  assert.match(panel, /No ve horas ni dinero/);
  assert.match(panel, /revokeTeamInvitation/);
  assert.doesNotMatch(panel, /PLATFORM_SUPERADMIN/);
});

test("supervisors do not get hours and billing", () => {
  const layout = read("src/layouts/AgencyLayout.tsx");
  assert.match(layout, /item\.to !== "\/agency\/timesheets"/);
  assert.equal((layout.match(/groups=\{groups\}/g) ?? []).length, 2);
  const page = read("src/pages/agency/AgencyTimesheetsPage.tsx");
  assert.match(page, /if\(!roles\.includes\("ORGANIZATION_ADMIN"\)\)return/);
  assert.match(page, /Esta sección es solo para administradores\./);
});

test("the activation page names the invited role", () => {
  const page = read("src/pages/OrganizationAdminInvitationPage.tsx");
  assert.match(page, /target_name\?\.startsWith\("Supervisor"\)/);
  assert.match(page, /Has sido invitado como supervisor de/);
});

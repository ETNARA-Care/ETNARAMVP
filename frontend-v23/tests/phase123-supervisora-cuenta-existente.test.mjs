import { shellEs } from "./_shellCatalog.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("staff who also work shifts can open both portals", () => {
  const roles = read("src/auth/roles.ts");
  assert.match(roles, /export function allowedExperiences/);
  assert.match(roles, /if \(roles\.includes\("WORKER"\)\) allowed\.push\("\/caregiver"\)/);
  const guard = read("src/auth/RoleGuard.tsx");
  assert.match(guard, /allowedExperiences\(roles\)\.includes\(experience\)/);
  assert.match(read("src/layouts/AgencyLayout.tsx"), /t\("agency\.myCaregiverDay"\)/); assert.equal(shellEs("agency.myCaregiverDay"), "Mi día como cuidador/a");
  assert.match(read("src/layouts/CaregiverLayout.tsx"), /t\("caregiver\.goToAgency"\)/); assert.equal(shellEs("caregiver.goToAgency"), "Ir a la agencia");
});

test("administrators make a caregiver a supervisor from her profile", () => {
  const card = read("src/features/agency/StaffRoleCard.tsx");
  assert.match(card, /setStaffRole\(organizationId, \{ workerMembershipId, role: "SUPERVISOR", enabled: confirming === "grant" \}, token\)/);
  assert.match(card, /NO_ACCOUNT_YET/);
  const profile = read("src/pages/agency/AgencyWorkerProfilePage.tsx");
  assert.match(profile, /roles\.includes\("ORGANIZATION_ADMIN"\) && \(\s+<StaffRoleCard/);
  const team = read("src/features/agency/TeamPanel.tsx");
  assert.match(team, /!member\.isYou && member\.roles\.map/);
  assert.match(team, /CANNOT_REMOVE_OWN_ADMIN/);
});

test("an existing account accepts the invitation after signing in", () => {
  const page = read("src/pages/OrganizationAdminInvitationPage.tsx");
  assert.match(page, /acceptOrganizationAdminInvitation\(token, session\)/);
  assert.match(page, /if \(status !== "authenticated"\) await login\(email\.trim\(\), password\)/);
  assert.match(page, /INVITATION_IDENTITY_MISMATCH/);
  assert.match(read("src/api/platformOrganizations.ts"), /"\/platform\/admin-invitations\/accept"/);
});

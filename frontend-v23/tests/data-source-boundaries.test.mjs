import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const realDataModules = [
  "src/features/agency/useAgencySupervision.ts",
  "src/features/messaging/ConversationUI.tsx",
  "src/features/notifications/NotificationBell.tsx",
  "src/features/notifications/useNotifications.ts",
  "src/layouts/AgencyLayout.tsx",
  "src/layouts/CaregiverLayout.tsx",
  "src/layouts/FamilyLayout.tsx",
  "src/layouts/TopHeader.tsx",
  "src/pages/agency/AgencyIncidentsPage.tsx",
  "src/pages/agency/AgencyIncidentDetailPage.tsx",
  "src/pages/agency/AgencyOverviewPage.tsx",
  "src/pages/agency/AgencyResidentProfilePage.tsx",
  "src/pages/agency/AgencyShiftsPage.tsx",
  "src/pages/agency/AgencySupportPages.tsx",
  "src/pages/caregiver/CaregiverShiftDetailPage.tsx",
  "src/pages/caregiver/CaregiverShiftsPage.tsx",
  "src/pages/caregiver/CaregiverSupportPages.tsx",
  "src/pages/family/FamilyMessagesPage.tsx",
  "src/pages/family/FamilyIncidentDetailPage.tsx",
  "src/pages/family/FamilyHistoryPage.tsx",
  "src/pages/family/FamilySupportPages.tsx",
  "src/pages/family/FamilyTodayPage.tsx",
];

test("real-data modules never import the demo store", async () => {
  for (const path of realDataModules) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.equal(
      source.includes("@/mocks/"),
      false,
      `${path} must fail visibly when the API is unavailable; it cannot fall back to demo data`,
    );
  }
});

test("the API client requires an explicit backend URL", async () => {
  const source = await readFile(new URL("../src/api/client.ts", import.meta.url), "utf8");
  assert.match(source, /if \(!raw\)/);
  assert.doesNotMatch(source, /mocks\/|DemoStore/);
});

test("operational DemoStore imports remain confined to the audited files", async () => {
  const pagesRoot = new URL("../src/pages/", import.meta.url);
  const paths = await readdir(pagesRoot, { recursive: true });
  const actual = [];

  for (const relativePath of paths.filter((path) => path.endsWith(".tsx"))) {
    const source = await readFile(new URL(relativePath, pagesRoot), "utf8");
    if (source.includes("@/mocks/DemoStoreContext")) actual.push(relativePath);
  }

  assert.deepEqual(actual.sort(), []);
});

test("validation fixes use curated real endpoints", async () => {
  const today = await readFile(new URL("../src/pages/family/FamilyTodayPage.tsx", import.meta.url), "utf8");
  const caregiver = await readFile(new URL("../src/pages/caregiver/CaregiverSupportPages.tsx", import.meta.url), "utf8");
  const incident = await readFile(new URL("../src/pages/caregiver/CaregiverShiftDetailPage.tsx", import.meta.url), "utf8");
  const family = await readFile(new URL("../src/pages/family/FamilySupportPages.tsx", import.meta.url), "utf8");

  assert.match(today, /listFamilyShifts/);
  assert.match(today, /caregiver\?\.displayName/);
  assert.match(caregiver, /listMyCredentials/);
  assert.match(incident, /createIncident/);
  assert.match(incident, /Reportar incidente/);
  assert.match(family, /Credenciales verificadas/);
  assert.match(family, /documentos y datos privados permanecen protegidos/);
});

test("incidents and notification surfaces use the real API", async () => {
  const incidents = await readFile(new URL("../src/pages/agency/AgencyIncidentsPage.tsx", import.meta.url), "utf8");
  const notificationBell = await readFile(new URL("../src/features/notifications/NotificationBell.tsx", import.meta.url), "utf8");
  const notificationsHook = await readFile(new URL("../src/features/notifications/useNotifications.ts", import.meta.url), "utf8");
  const notificationsApi = await readFile(new URL("../src/api/notifications.ts", import.meta.url), "utf8");
  const family = await readFile(new URL("../src/pages/family/FamilySupportPages.tsx", import.meta.url), "utf8");
  const agencyLayout = await readFile(new URL("../src/layouts/AgencyLayout.tsx", import.meta.url), "utf8");

  assert.match(incidents, /listIncidents/);
  assert.match(incidents, /listCareRecipients/);
  assert.match(notificationBell, /useNotifications/);
  assert.match(notificationsHook, /listMyNotifications/);
  assert.match(notificationsHook, /markNotificationRead/);
  assert.match(notificationsApi, /notification_type/);
  assert.match(notificationsApi, /read_at/);
  assert.match(family, /markAllRead/);
  assert.doesNotMatch(agencyLayout, /badge:\s*2/);
});

test("incident notifications navigate to role-appropriate detail pages", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const bell = await readFile(new URL("../src/features/notifications/NotificationBell.tsx", import.meta.url), "utf8");
  const familyNotifications = await readFile(new URL("../src/pages/family/FamilySupportPages.tsx", import.meta.url), "utf8");

  assert.match(app, /path="incidents\/:incidentId" element={<FamilyIncidentDetailPage/);
  assert.match(app, /path="incidents\/:incidentId" element={<AgencyIncidentDetailPage/);
  assert.match(app, /path="residents\/:residentId" element={<AgencyResidentProfilePage/);
  assert.match(bell, /\/family\/incidents\/\$\{entityId\}/);
  assert.match(bell, /\/agency\/incidents\/\$\{entityId\}/);
  assert.match(familyNotifications, /\/family\/incidents\/\$\{entityId\}/);
});

test("Family incident detail uses only the curated family-safe contract", async () => {
  const familyDetail = await readFile(new URL("../src/pages/family/FamilyIncidentDetailPage.tsx", import.meta.url), "utf8");
  const incidentsApi = await readFile(new URL("../src/api/incidents.ts", import.meta.url), "utf8");

  assert.match(familyDetail, /listFamilyIncidents/);
  assert.doesNotMatch(familyDetail, /getIncident/);
  assert.doesNotMatch(familyDetail, /actions_taken|assigned_to_user_id|resolution/);
  assert.match(incidentsApi, /family-incidents/);
});

test("Administration detail and resident profile use real organization APIs", async () => {
  const incidentDetail = await readFile(new URL("../src/pages/agency/AgencyIncidentDetailPage.tsx", import.meta.url), "utf8");
  const residentProfile = await readFile(new URL("../src/pages/agency/AgencyResidentProfilePage.tsx", import.meta.url), "utf8");

  assert.match(incidentDetail, /getIncident/);
  assert.match(incidentDetail, /listIncidentTimeline/);
  assert.match(incidentDetail, /getCareRecipient/);
  assert.match(residentProfile, /getCareRecipient/);
  assert.match(residentProfile, /listIncidents/);
  assert.match(residentProfile, /useAgencySupervision/);
  assert.doesNotMatch(incidentDetail, /@\/mocks\//);
  assert.doesNotMatch(residentProfile, /@\/mocks\//);
});

test("Family History uses only family-safe shifts and timeline", async () => {
  const history = await readFile(new URL("../src/pages/family/FamilyHistoryPage.tsx", import.meta.url), "utf8");

  assert.match(history, /listMyCareRecipients/);
  assert.match(history, /listFamilyShifts/);
  assert.match(history, /getFamilyTimeline/);
  assert.doesNotMatch(history, /DemoStore|@\/mocks\//);
  assert.match(history, /status === "completed"/);
});

test("Administration Workers uses real organization workers and credential summaries", async () => {
  const workers = await readFile(new URL("../src/pages/agency/AgencySupportPages.tsx", import.meta.url), "utf8");
  const shiftsApi = await readFile(new URL("../src/api/shifts.ts", import.meta.url), "utf8");

  assert.match(workers, /listWorkers/);
  assert.match(workers, /getWorkerProfile/);
  assert.match(workers, /credentialsSummary/);
  assert.doesNotMatch(workers, /DemoStore|useWorkers|available/);
  assert.match(shiftsApi, /\/workers\/\$\{membershipId\}/);
});

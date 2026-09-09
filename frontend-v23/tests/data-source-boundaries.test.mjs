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
  "src/pages/agency/AgencyOverviewPage.tsx",
  "src/pages/agency/AgencyShiftsPage.tsx",
  "src/pages/caregiver/CaregiverShiftDetailPage.tsx",
  "src/pages/caregiver/CaregiverShiftsPage.tsx",
  "src/pages/caregiver/CaregiverSupportPages.tsx",
  "src/pages/family/FamilyMessagesPage.tsx",
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

  assert.deepEqual(actual.sort(), [
    "agency/AgencySupportPages.tsx",
    "family/FamilyHistoryPage.tsx",
  ]);
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

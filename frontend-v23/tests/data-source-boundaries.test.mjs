import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const realDataModules = [
  "src/features/agency/useAgencySupervision.ts",
  "src/features/messaging/ConversationUI.tsx",
  "src/pages/agency/AgencyOverviewPage.tsx",
  "src/pages/agency/AgencyShiftsPage.tsx",
  "src/pages/caregiver/CaregiverShiftDetailPage.tsx",
  "src/pages/caregiver/CaregiverShiftsPage.tsx",
  "src/pages/caregiver/CaregiverSupportPages.tsx",
  "src/pages/family/FamilyMessagesPage.tsx",
  "src/pages/family/FamilySupportPages.tsx",
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
    "family/FamilyTodayPage.tsx",
  ]);
});

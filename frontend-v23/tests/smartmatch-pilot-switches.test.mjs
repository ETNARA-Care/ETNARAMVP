import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("pilot: SmartMatch pages are routed only for agencies with SMARTMATCH", () => {
  const app = read("src/App.tsx");
  assert.match(app, /<FeatureRoute feature="SMARTMATCH" fallback="\/caregiver"><CaregiverSmartMatchPage\/><\/FeatureRoute>/);
  assert.match(app, /<FeatureRoute feature="SMARTMATCH" fallback="\/agency"><AgencySmartMatchPage\/><\/FeatureRoute>/);
  const helper = read("src/auth/orgFeatures.tsx");
  assert.match(helper, /Array\.isArray\(features\) && features\.includes\(feature\)/, "missing features (older backend) means off");
});

test("pilot: SmartMatch links and panels hidden without the feature", () => {
  assert.match(read("src/layouts/AgencyLayout.tsx"), /\(smartMatch \|\| item\.to !== "\/agency\/smartmatch"\)/);
  assert.match(read("src/layouts/CaregiverLayout.tsx"), /\.\.\.\(smartMatch \? \[\{ to: "\/caregiver\/smartmatch"/);
  assert.match(read("src/pages/agency/AgencyOverviewPage.tsx"), /hasOrgFeature\(activeOrganization\.features, "SMARTMATCH"\) && <SmartMatchPanel/);
  assert.match(read("src/pages/agency/AgencyShiftDetailPage.tsx"), /\{smartMatch && organizationId && shiftId && <ShiftPrivateInstructions/);
  assert.match(read("src/pages/caregiver/CaregiverShiftDetailPage.tsx"), /\{smartMatch && organizationId && shiftId && <ShiftPrivateInstructions/);
});

test("pilot: «En camino» and «Llegué» hidden without EN_CAMINO; Comenzar/Finalizar untouched", () => {
  const cg = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.match(cg, /\{enCamino && canStart && organizationId && shiftId && !verification\.arrivals\?\.length && \(/);
  assert.match(cg, /\{enCamino && canStart && organizationId && shiftId && \(\s*<div id="arrival-card"[^>]*>\s*<ArrivalCard/);
  assert.match(cg, /\{canStart && \(\s*<div className="flex flex-col gap-2">/, "start/finish buttons are not gated");
  assert.match(read("src/pages/caregiver/CaregiverSupportPages.tsx"), /hasOrgFeature\(activeOrganization\.features, "EN_CAMINO"\) && <LocationConsentCard/);
  assert.match(read("src/pages/agency/AgencyShiftDetailPage.tsx"), /\{enCamino && organizationId && shiftId && <ShiftJourneyHistory/);
  assert.match(read("src/pages/agency/AgencyOperationsPage.tsx"), /hasOrgFeature\(activeOrganization\.features, "EN_CAMINO"\) && <TodayJourneysPanel/);
  assert.match(read("src/pages/family/FamilyTodayPage.tsx"), /\{shift\?\.journey && <FamilyJourneyProgress/, "backend sends journey: null when off");
});

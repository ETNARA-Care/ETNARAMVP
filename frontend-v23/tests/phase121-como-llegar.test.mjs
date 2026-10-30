import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Phase 12.1 «Cómo llegar», as evolved by Gate 6 (service locations per shift).

test("the location API uses the shared client and handles 'no access' as no address", () => {
  const api = read("src/api/serviceLocations.ts");
  assert.match(api, /from "\.\/client"/);
  assert.match(api, /\/shifts\/\$\{shiftId\}\/service-location/);
  assert.match(api, /status === 404\) return null/);
  assert.doesNotMatch(api, /localStorage|sessionStorage|mock/i);
});

test("directions prefer coordinates and build Apple Maps, Google Maps and Waze links", () => {
  const nav = read("src/features/serviceLocation/navigation.ts");
  assert.match(nav, /https:\/\/maps\.apple\.com\/\?daddr=/);
  assert.match(nav, /https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
  assert.match(nav, /https:\/\/waze\.com\/ul\?ll=/);
  assert.match(nav, /https:\/\/waze\.com\/ul\?q=/);
  assert.match(nav, /hasCoordinates\(l\) \? `\$\{l\.latitude\},\$\{l\.longitude\}`/);
  assert.match(nav, /encodeURIComponent/);
  assert.match(nav, /"Puerto Rico"/);
});

test("the caregiver shift shows Cómo llegar until the visit ends, without blocking the shift", () => {
  const page = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.match(page, /getShiftServiceLocation\(organizationId, shiftRow\.id, token\)\.catch\(\(\) => null\)/);
  assert.match(page, /status !== "completed" && status !== "cancelled" && !overdue && <ServiceDirectionsCard location=\{location\} \/>/);
  const card = read("src/features/serviceLocation/ServiceDirectionsCard.tsx");
  for (const label of ["Cómo llegar", "Apple Maps", "Google Maps", "Waze", "Copiar"]) assert.ok(card.includes(label), label);
  assert.match(card, /rel="noopener noreferrer"/);
  assert.match(card, /navigator\.clipboard\.writeText/);
});

test("the agency manages the service location from the resident record", () => {
  const page = read("src/pages/agency/AgencyResidentProfilePage.tsx");
  assert.match(page, /<ServiceLocationSection organizationId=\{organizationId\} recipientId=\{residentId\} \/>/);
  const section = read("src/features/serviceLocation/ServiceLocationSection.tsx");
  assert.match(section, /Ubicación del servicio/);
  assert.match(section, /maxLength=\{200\}/);
  assert.match(section, /maxLength=\{500\}/);
});

test("the family app only uses its own permission-gated route, never the agency or shift routes", () => {
  for (const file of ["src/pages/family/FamilyTodayPage.tsx", "src/pages/family/FamilyHistoryPage.tsx", "src/pages/family/FamilySupportPages.tsx", "src/layouts/FamilyLayout.tsx"]) {
    const src = read(file);
    assert.doesNotMatch(src, /getShiftServiceLocation|ServiceDirectionsCard|listServiceLocations|\/care-recipients\/[^"`]*\/service-locations/, file);
  }
});

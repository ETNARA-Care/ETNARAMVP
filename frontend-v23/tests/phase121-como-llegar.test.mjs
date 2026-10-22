import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the location API uses the shared client and the 12.1 route", () => {
  const api = read("src/api/recipientLocation.ts");
  assert.match(api, /from "\.\/client"/);
  assert.match(api, /\/care-recipients\/\$\{recipientId\}\/location/);
  assert.match(api, /apiClient\.put/);
  assert.match(api, /status === 404\) return null/);
  assert.doesNotMatch(api, /localStorage|sessionStorage|mock/i);
});

test("directions prefer coordinates and build Google Maps and Waze links", () => {
  const directions = read("src/features/caregiver/directions.ts");
  assert.match(directions, /https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
  assert.match(directions, /https:\/\/waze\.com\/ul\?ll=/);
  assert.match(directions, /https:\/\/waze\.com\/ul\?q=/);
  assert.match(directions, /encodeURIComponent/);
  assert.match(directions, /"Puerto Rico"/);
});

test("the caregiver shift shows Cómo llegar until the visit ends, without blocking the shift", () => {
  const page = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.match(page, /getRecipientLocation\(organizationId, shiftRow\.care_recipient_id, token\)\.catch\(\(\) => null\)/);
  assert.match(page, /status !== "completed" && status !== "cancelled" && <DirectionsCard location=\{location\} \/>/);
  const card = read("src/features/caregiver/DirectionsCard.tsx");
  assert.match(card, /Cómo llegar/);
  assert.match(card, /Google Maps/);
  assert.match(card, /Waze/);
  assert.match(card, /Copiar dirección/);
  assert.match(card, /rel="noopener noreferrer"/);
  assert.match(card, /navigator\.clipboard\.writeText/);
});

test("the agency edits the address from the resident profile", () => {
  const page = read("src/pages/agency/AgencyResidentProfilePage.tsx");
  assert.match(page, /saveRecipientLocation\(organizationId, residentId/);
  assert.match(page, /Dirección y acceso/);
  assert.match(page, /La familia no la ve/);
  assert.match(page, /coordinates === "invalid"/);
  assert.match(page, /maxLength=\{200\}/);
  assert.match(page, /maxLength=\{500\}/);
});

test("the family app never asks for the address", () => {
  for (const file of ["src/pages/family/FamilyTodayPage.tsx", "src/pages/family/FamilyHistoryPage.tsx", "src/pages/family/FamilySupportPages.tsx", "src/layouts/FamilyLayout.tsx"]) {
    assert.doesNotMatch(read(file), /recipientLocation|DirectionsCard|\/location/, file);
  }
});

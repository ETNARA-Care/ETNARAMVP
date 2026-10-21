import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("caregiver portal shows the real notification inbox", () => {
  const layout = read("src/layouts/CaregiverLayout.tsx");
  assert.match(layout, /import \{ NotificationBell \} from "@\/features\/notifications\/NotificationBell"/);
  assert.match(layout, /<NotificationBell \/>/);
});

test("caregiver home surfaces pending open-shift offers from the real contract", () => {
  const today = read("src/pages/caregiver/CaregiverTodayPage.tsx");
  assert.match(today, /listMyCoverageOffers/);
  assert.match(today, /responseStatus === "pending"/);
  assert.match(today, /to="\/caregiver\/shifts"/);
  assert.doesNotMatch(today, /DemoStore|mocks\//);
});

test("caregiver shift detail shows one state-driven primary action", () => {
  const detail = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.match(detail, /\{canStart && \(/);
  assert.match(detail, /\{canFinish && \(/);
  // Start and finish are no longer rendered side by side as disabled secondary buttons.
  assert.doesNotMatch(detail, /disabled=\{!canStart \|\| saving\}/);
  assert.doesNotMatch(detail, /disabled=\{!canFinish \|\| saving\}/);
  // The primary action comes before the care plan.
  assert.ok(detail.indexOf("Comenzar turno") < detail.indexOf(">Plan de cuidado<"));
});

test("family home stays calm when there is no shift today", () => {
  const today = read("src/pages/family/FamilyTodayPage.tsx");
  assert.match(today, /if \(!shift\) return \{ tone: "neutral" as const, label: "Sin turno hoy" \}/);
  assert.doesNotMatch(today, /Aún sin cuidador asignado/);
  assert.match(today, /Escríbele a la agencia/);
  assert.match(today, /listFamilyShifts/);
});

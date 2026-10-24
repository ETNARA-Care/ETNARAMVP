import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("caregiver availability accepts overnight windows (end before start = next day) and refuses equal times", () => {
  const page = read("src/pages/caregiver/CaregiverSupportPages.tsx");
  assert.match(page, /day\.enabled && day\.startTime === day\.endTime/);
  assert.doesNotMatch(page, /day\.startTime >= day\.endTime/);
  assert.match(page, /data-ui="overnight-hint"/);
  assert.match(page, /termina al día siguiente/);
});

test("SmartMatch review lists the schedule-conflict check, hidden when an older server does not report it", () => {
  const page = read("src/pages/agency/AgencySmartMatchPage.tsx");
  assert.match(page, /key: "noScheduleConflict", label: "Sin otro turno ni visita aprobada en ese horario"/);
  assert.match(page, /CHECK_ROWS\.filter\(\(row\) => review\.checks\[row\.key\] !== undefined\)/);
  assert.match(read("src/api/smartmatch.ts"), /noScheduleConflict\?: boolean/);
});

test("new server error codes have Spanish messages", () => {
  const text = read("src/features/smartmatch/smartmatchText.ts");
  assert.match(text, /case "OPPORTUNITY_TOO_LONG": return "Una oportunidad puede durar como máximo 24 horas/);
  assert.match(text, /case "OPPORTUNITY_IN_PAST":/);
  assert.match(text, /ya tiene otro turno a esa hora/);
});

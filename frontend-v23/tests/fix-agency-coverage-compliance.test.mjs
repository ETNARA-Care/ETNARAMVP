import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("one coverage rule: only an accepted assignment counts as covered", () => {
  const rule = read("src/features/agency/shiftCoverage.ts");
  assert.match(rule, /if \(shift\.assignmentResponse === "accepted"\)/);
  assert.match(rule, /if \(shift\.assignmentResponse === "pending"\) return "awaiting"/);
  assert.match(rule, /LATE_AFTER_MS = 15 \* 60_000/);
  assert.match(rule, /awaiting: "Esperando respuesta"/);
  assert.match(rule, /late: "Sin llegada"/);
});

test("the supervision hook exposes the assignment response", () => {
  const hook = read("src/features/agency/useAgencySupervision.ts");
  assert.match(hook, /assignmentResponse\?: "pending" \| "accepted" \| null/);
  assert.match(hook, /assignmentResponse: \(activeAssignmentByShiftId\[shift\.id\]\?\.response_status/);
});

test("summary, shift board, shifts and residents use the same rule", () => {
  const briefing = read("src/pages/agency/overview/Briefing.tsx");
  assert.match(briefing, /summarizeCoverage\(todayShifts\)/);
  assert.match(briefing, /Turnos confirmados hoy/);
  assert.doesNotMatch(briefing, /Boolean\(s\.caregiver\)/);
  const board = read("src/pages/agency/overview/ShiftBoard.tsx");
  assert.match(board, /summarizeCoverage\(active\)/);
  assert.doesNotMatch(board, /filter\(\(s\) => !s\.caregiver\)/);
  const shifts = read("src/pages/agency/AgencyShiftsPage.tsx");
  assert.match(shifts, /coverageOf\(\{ \.\.\.shift, assignmentResponse/);
  assert.doesNotMatch(shifts, /<StatusBadge status=\{shift\.status\} \/>/);
  const residents = read("src/pages/agency/AgencySupportPages.tsx");
  assert.match(residents, /Esperando respuesta de \$\{workerName\}/);
});

test("compliance does not count establishment requirements when there are no establishments", () => {
  const panel = read("src/pages/agency/EstablishmentCompliancePanel.tsx");
  assert.match(panel, /if\(places\.length===0\)return null;/);
  const center = read("src/pages/agency/AgencyComplianceCenterPage.tsx");
  assert.match(center, /if\(places\.length===0\)return <Card>/);
  assert.match(center, /Esta agencia no tiene establecimientos/);
  const readiness = read("src/pages/agency/overview/ReadinessPanel.tsx");
  assert.match(readiness, /"Sin establecimientos"/);
  assert.doesNotMatch(readiness, /"Sin residentes activos"/);
});

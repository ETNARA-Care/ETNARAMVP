import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detail = readFileSync(new URL("../src/pages/caregiver/CaregiverShiftDetailPage.tsx", import.meta.url), "utf8");

test("the caregiver is told, in Spanish, that she already has a confirmed shift at that time", () => {
  assert.match(detail, /apiError\.code === "MY_SCHEDULE_CONFLICT"\) return "Ya tienes otro turno confirmado en ese horario\."/);
  // The message names no agency, patient or time.
  const line = detail.split("\n").find((l) => l.includes("MY_SCHEDULE_CONFLICT") && l.includes("return"));
  assert.doesNotMatch(line, /agencia|paciente|\$\{/);
});

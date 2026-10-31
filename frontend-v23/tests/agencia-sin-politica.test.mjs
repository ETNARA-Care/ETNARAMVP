import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Auditoría integral (30-oct-2026): una agencia sin política de credenciales recibe 409
// NO_APPLICABLE_REQUIREMENT_SET (antes 500). El portal dice qué hacer en lugar de un error genérico.
test("agency: assigning without a credential policy points to Cumplimiento → Políticas", () => {
  assert.match(read("src/pages/agency/AgencyShiftsPage.tsx"), /NO_APPLICABLE_REQUIREMENT_SET"\) return "La agencia todavía no configuró los requisitos[^"]*Cumplimiento → Políticas\."/);
});

test("caregiver: starting a shift without a policy explains it is up to the agency (online and offline queue)", () => {
  assert.match(read("src/pages/caregiver/CaregiverShiftDetailPage.tsx"), /NO_APPLICABLE_REQUIREMENT_SET"\) return "Tu agencia todavía no configuró los requisitos de tu puesto/);
  assert.match(read("src/features/caregiver/careEventQueue.ts"), /NO_APPLICABLE_REQUIREMENT_SET"\) return "Tu agencia todavía no configuró los requisitos de tu puesto/);
});

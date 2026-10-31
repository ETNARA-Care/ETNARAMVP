// C1/C2 (auditoría 31-oct-2026): en el portal, la administración de un establecimiento no ofrece
// cambiar rol, estado ni nombre del personal; los rechazos del servidor tienen mensaje claro.
// La autorización real está en el backend (verifyEstablishmentAgencyChanges, ambos modos).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const profile = read("src/pages/caregiver/EstablishmentWorkerProfilePage.tsx");
const roster = read("src/api/roster.ts");
const agency = read("src/pages/agency/AgencyEstablishmentPage.tsx");

test("C2 la ficha del personal solo ofrece «Editar» a administración o supervisión de la agencia", () => {
  assert.match(profile, /const canChangeStaff = roles\.includes\("ORGANIZATION_ADMIN"\) \|\| roles\.includes\("SUPERVISOR"\);/);
  assert.match(profile, /\{editing && canChangeStaff \?/);
  assert.match(profile, /data-testid="staff-change-agency-only"/);
});

test("C1/C2 mensajes claros para los rechazos nuevos del servidor", () => {
  assert.match(roster, /code === "RESIDENT_TRANSFER_FORBIDDEN"/);
  assert.match(roster, /code === "ESTABLISHMENT_STAFF_ASSIGNMENT_FORBIDDEN"/);
  assert.match(roster, /code === "ESTABLISHMENT_STAFF_CHANGE_FORBIDDEN"\) return ESTABLISHMENT_STAFF_CHANGE_MESSAGE/);
  assert.match(agency, /toast\.show\(establishmentAssignmentErrorMessage\(assignError\), "danger"\)/);
});

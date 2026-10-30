import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Decisión de Rafa (30-oct-2026): la agencia no cambia el nombre de una cuidadora con la membresía
// inactiva. El backend responde 409 WORKER_MEMBERSHIP_INACTIVE; el portal no ofrece el cambio y,
// si llega el error, lo explica en lugar de «No pudimos actualizar».
test("the backend codes for an inactive rename map to an explicit message", () => {
  const roster = read("src/api/roster.ts");
  assert.match(roster, /code === "WORKER_MEMBERSHIP_INACTIVE"\) return INACTIVE_RENAME_MESSAGE/);
  assert.match(roster, /Reactívala para cambiar su nombre\./);
  assert.match(roster, /code === "WORKER_PROFILE_NOT_SAVED"/);
});

test("agency profile: name locked while the membership is inactive; save errors use the mapping", () => {
  const page = read("src/pages/agency/AgencyWorkerProfilePage.tsx");
  assert.match(page, /label="Nombre completo"[^\n]*disabled=\{worker\.status !== "active"\}/);
  assert.match(page, /workerUpdateErrorMessage\(error, "No pudimos actualizar la información\."\)/);
});

test("establishment profile: name locked unless the form status is active (reactivate + rename is allowed)", () => {
  const page = read("src/pages/caregiver/EstablishmentWorkerProfilePage.tsx");
  assert.match(page, /label="Nombre"[^\n]*disabled=\{form\.status !== "active"\}/);
  assert.match(page, /workerUpdateErrorMessage\(error, "No pudimos actualizar el personal\."\)/);
});

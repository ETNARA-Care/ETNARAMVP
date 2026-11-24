import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/pages/agency/AgencyWorkerProfilePage.tsx", import.meta.url), "utf8");

// 162 (24-nov-2026): una agencia sin membresía activa conserva el perfil, no las credenciales ni los archivos.
test("perfil de una persona inactiva: aviso claro en lugar de «Sin credenciales registradas»", () => {
  assert.match(page, /data-ui="former-member-credentials"/);
  assert.match(page, /worker\.status !== "active" \? \(/);
  assert.match(page, /ya no pertenece a la agencia: sus credenciales y archivos profesionales no están disponibles/);
  assert.match(page, /El historial de revisiones de la agencia se conserva/);
});

test("con membresía activa nada cambia: lista, alta de credenciales y estado vacío", () => {
  assert.match(page, /\{worker\.status === "active" && <Button icon=\{<Plus size=\{18\} \/>\} onClick=\{openCredentialCreate\}/);
  assert.match(page, /<EmptyState title="Sin credenciales registradas" \/>/);
  assert.match(page, /credentials\.map\(\(credential\) =>/);
});

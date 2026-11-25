import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const load = async (path) => {
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
};
const card = read("src/features/platform/PlatformModalitiesCard.tsx");
const api = read("src/api/platformModalities.ts");
const page = read("src/pages/platform/PlatformOrganizationsPage.tsx");

// 163 (24-nov-2026): interruptor de la modalidad «Cuidador independiente», solo en ETNARA Central.
test("apagar siempre; encender solo con la autorización del servidor y el candado de la base abierto", async () => {
  const m = await load("src/features/platform/modalitySwitch.ts");
  assert.equal(m.switchAvailable({ enabled: false, activationAllowed: false, databaseUnlocked: false }), false);
  assert.equal(m.switchAvailable({ enabled: false, activationAllowed: true, databaseUnlocked: false }), false);
  assert.equal(m.switchAvailable({ enabled: false, activationAllowed: false, databaseUnlocked: true }), false);
  assert.equal(m.switchAvailable({ enabled: false, activationAllowed: true, databaseUnlocked: true }), true);
  assert.equal(m.switchAvailable({ enabled: true, activationAllowed: false, databaseUnlocked: false }), true);
  assert.match(m.stateNote({ enabled: false, activationAllowed: false, databaseUnlocked: false }), /servidor y en la base de datos/);
  assert.match(m.modalityErrorMessage("MODALITY_ACTIVATION_NOT_AUTHORIZED"), /no está autorizada/);
  assert.match(m.modalityErrorMessage("MODALITY_ACTIVATION_LOCKED"), /candado de la base de datos/);
  assert.deepEqual(m.lockLines({ enabled: false, activationAllowed: false, databaseUnlocked: false }), ["Servidor: sin autorización", "Base de datos: candado cerrado"]);
});

test("el motivo es obligatorio (10 a 1000 caracteres)", async () => {
  const m = await load("src/features/platform/modalitySwitch.ts");
  assert.equal(m.reasonValid("corto"), false);
  assert.equal(m.reasonValid("          "), false);
  assert.equal(m.reasonValid("Motivo suficiente"), true);
  assert.equal(m.reasonValid("x".repeat(1001)), false);
});

test("la tarjeta vive solo en Central, usa la API de plataforma y muestra el historial", () => {
  assert.match(api, /"\/platform\/modalities"/);
  assert.match(api, /`\/platform\/modalities\/\$\{code\}`/);
  assert.match(page, /<PlatformModalitiesCard \/>/);
  assert.match(card, /disabled=\{saving \|\| !available\}/);
  assert.match(card, /disabled=\{saving \|\| !reasonValid\(reason\)\}/);
  assert.match(card, /no interrumpe a los proveedores ya registrados/);
  assert.match(card, /data-ui="modality-history"/);
});

// Alcance no médico (14-nov-2026): ETNARA administra cuidado NO médico.
// Sin borrar datos ni registros históricos; sin afirmar nada sobre HIPAA.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const scope = read("src/features/scope/nonMedicalScope.ts");

test("un solo módulo define el alcance no médico y no afirma exención de HIPAA", () => {
  assert.match(scope, /NON_MEDICAL_TEXT_HINT = "Solo cuidado cotidiano\. No escribas diagnósticos, medicamentos ni tratamientos\."/);
  assert.match(scope, /determinación jurídica pendiente/);
  assert.doesNotMatch(scope, /exent[ao]/i);
});

test("«Recordatorio de medicamentos» no se ofrece para tareas nuevas, pero una tarea antigua lo conserva", () => {
  assert.match(scope, /RETIRED_TASK_CATEGORIES: readonly CarePlanTaskCategory\[\] = \["MEDICATION_REMINDER"\]/);
  assert.match(scope, /!RETIRED_TASK_CATEGORIES\.includes\(value\) \|\| value === current/);
  const profile = read("src/pages/agency/AgencyResidentProfilePage.tsx");
  assert.match(profile, /selectableTaskCategories\(task\.category\)\.map/);
  assert.doesNotMatch(profile, /Object\.entries\(taskCategoryLabels\)\.map/);
  // El backend sigue aceptando la categoría y la etiqueta histórica se sigue mostrando.
  const api = read("src/api/carePlans.ts");
  assert.match(api, /\| "MEDICATION_REMINDER"/);
  assert.match(api, /MEDICATION_REMINDER: "Recordatorio de medicamentos"/);
});

test("el campo de alergias se conserva, limitado a la seguridad cotidiana, en los tres formularios", () => {
  assert.match(scope, /ALLERGIES_LABEL = "Alergias y restricciones alimentarias"/);
  assert.match(scope, /Sin diagnósticos ni medicamentos/);
  for (const f of ["src/pages/agency/AgencyResidentProfilePage.tsx", "src/pages/agency/AgencySupportPages.tsx", "src/pages/caregiver/EstablishmentResidentProfilePage.tsx"]) {
    const src = read(f);
    assert.match(src, /hint=\{ALLERGIES_HINT\}/, f);
    assert.doesNotMatch(src, /label="Alergias/, f);
  }
});

test("los campos de texto libre avisan que no se escriban datos médicos", () => {
  const profile = read("src/pages/agency/AgencyResidentProfilePage.tsx");
  for (const l of ["objetivo", "instrucción", "precaución"]) assert.match(profile, new RegExp(`Escribe una? ${l} por línea\\. \\$\\{NON_MEDICAL_TEXT_HINT\\}`));
  assert.match(profile, /label="Detalles \(opcional\)" hint=\{NON_MEDICAL_TEXT_HINT\}/);
  const shift = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.match(shift, /required=\{activeAction === "NOTE"\} hint=\{NON_MEDICAL_TEXT_HINT\}/);
  assert.match(shift, /required hint=\{NON_MEDICAL_TEXT_HINT\} placeholder="Describe lo ocurrido/);
});

test("la foto de actividad avisa: nada de heridas, medicamentos ni documentos médicos (es/en)", () => {
  assert.match(read("src/features/activityPhotos/PhotoPicker.tsx"), /t\("picker\.nonMedical"\)/);
  assert.match(JSON.parse(read("src/i18n/locales/es/photos.json")).picker.nonMedical, /heridas, medicamentos ni documentos médicos/);
  assert.match(JSON.parse(read("src/i18n/locales/en/photos.json")).picker.nonMedical, /wounds, medications or medical documents/);
});

test("ningún texto de facturación sugiere que ETNARA guarda diagnósticos", () => {
  assert.doesNotMatch(read("src/i18n/locales/es/billing.json"), /diagnóstico/i);
  assert.doesNotMatch(read("src/i18n/locales/en/billing.json"), /diagnos/i);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const load = async (path) => {
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
};

// Fase 1 independientes (25-nov-2026): sin «agencia» en una práctica; agencias y hogares conservan sus textos.
test("familia: en una práctica se escribe a «tu cuidador(a)»; en una agencia, a la agencia (sin cambios)", async () => {
  const m = await load("src/features/practice/practiceText.ts");
  assert.equal(m.familyWriteText(true), "Escríbele a tu cuidador(a)");
  assert.equal(m.familyWriteText(false), "Escríbele a la agencia");
  assert.equal(m.familyPendingCaregiverText(false), "La agencia está confirmando quién le atenderá");
  assert.doesNotMatch(m.familyPendingCaregiverText(true), /agencia/i);
  const ind = m.serviceLocationText(true), ag = m.serviceLocationText(false);
  for (const v of Object.values(ind)) assert.doesNotMatch(v, /agencia/i);
  assert.equal(ag.send, "Enviar a la agencia");
  assert.equal(ag.keeps, "La agencia mantiene la dirección del servicio. Si ves un error, puedes pedir una corrección.");
});

test("cuidadora: en una práctica ningún aviso del turno menciona a la agencia; en una agencia, iguales que antes", async () => {
  const m = await load("src/features/practice/practiceText.ts");
  for (const v of Object.values(m.caregiverShiftText(true))) assert.doesNotMatch(v, /agencia/i);
  const ag = m.caregiverShiftText(false);
  assert.equal(ag.cancelledTitle, "La agencia canceló esta visita");
  assert.equal(ag.outsideWindow, "Este turno ya terminó. No se puede comenzar; avísale a la agencia.");
  assert.equal(ag.arrivalWhat, "«Llegué» le confirma a la agencia que estás en el lugar del servicio. Es distinto de comenzar el turno.");
});

test("llegada: en una práctica queda registrada sin «la agencia lo revisará»; en una agencia, igual", async () => {
  const m = await load("src/features/serviceLocation/arrivalText.ts");
  for (const p of ["FAR", "NO_CONSENT", "UNAVAILABLE"]) {
    assert.match(m.proximityText(p, true), /queda registrado/);
    assert.doesNotMatch(m.proximityText(p, true), /agencia/i);
    assert.match(m.proximityText(p, false), /la agencia lo revisará/);
  }
  assert.equal(m.proximityText("NEAR", true), m.proximityText("NEAR", false));
  // Nunca como verificada: la advertencia se mantiene y nadie la «aprueba» (backend 164: ARRIVAL_REVIEW_NOT_APPLICABLE).
  for (const p of ["FAR", "NO_CONSENT", "UNAVAILABLE"]) assert.match(m.proximityText(p, true), /no verificada/);
  const panel = read("src/features/serviceLocation/ShiftVisitPanel.tsx");
  assert.match(panel, /a\.needsReview && !a\.reviewedAt && independent && <div[^>]*data-testid="practice-arrival-unverified"/);
  assert.match(panel, /<Badge tone="warning">Ubicación no verificada<\/Badge>/);
  assert.match(panel, /a\.needsReview && !a\.reviewedAt && !independent && /);
  const card = read("src/features/serviceLocation/ArrivalCard.tsx");
  assert.match(card, /result\.needsReview \? "warning" : "success"/);
  const hist = read("src/features/journey/ShiftJourneyHistory.tsx");
  assert.match(hist, /d\.needsReview \? \(independent \? "Ubicación no verificada" : d\.reviewed \? "Revisada por la agencia" : "Pendiente de revisión"\)/);
});

test("las pantallas usan los textos según el tipo de organización", () => {
  const today = read("src/pages/family/FamilyTodayPage.tsx");
  assert.match(today, /familyWriteText\(independent\)/);
  assert.doesNotMatch(today, />Escríbele a la agencia</);
  const loc = read("src/features/family/FamilyServiceLocationCard.tsx");
  assert.doesNotMatch(loc, /"Enviar a la agencia"|"Ubicación marcada por la agencia"|>Verificada por la agencia</);
  const shift = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.doesNotMatch(shift, />La agencia canceló esta visita</);
  assert.match(shift, /show\(actionError\(requestError, independent\), "danger"\)/);
  const layout = read("src/layouts/CaregiverLayout.tsx");
  assert.match(layout, /"caregiver\.goToPractice" : "caregiver\.goToAgency"/);
  for (const lang of ["es", "en"]) {
    const shell = JSON.parse(read(`src/i18n/locales/${lang}/shell.json`));
    assert.ok(shell.caregiver.goToPractice && shell.caregiver.alsoPracticeAdmin && shell.caregiver.goToAgency);
  }
});

test("activación: nombre profesional obligatorio solo al crear la cuenta de una práctica", () => {
  const page = read("src/pages/OrganizationAdminInvitationPage.tsx");
  assert.match(page, /\{invitation\.independent && <Input label="Tu nombre profesional"/);
  assert.match(page, /activateOrganizationAdminInvitation\(token, password, invitation\.independent \? professionalName\.trim\(\) : undefined\)/);
  const api = read("src/api/platformOrganizations.ts");
  assert.match(api, /independent\?: boolean;/);
  assert.match(api, /\.\.\.\(professionalName \? \{ professionalName \} : \{\}\)/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const detail = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
const panel = read("src/features/serviceLocation/ShiftVisitPanel.tsx");
const provider = read("src/features/caregiver/CareEventQueueProvider.tsx");

test("A: «Comenzar turno» never says it records the arrival", () => {
  for (const text of ["Registrando llegada", "Llegada registrada. Turno iniciado", "se registra tu llegada", "Llegada registrada · turno iniciado", "Tu llegada quedó guardada"]) {
    assert.ok(!detail.includes(text), `still says: ${text}`);
  }
  assert.match(detail, /"Iniciando turno\.\.\." : "Comenzar turno"/);
  assert.match(detail, /show\("Turno iniciado\.", "success"\)/);
  assert.match(detail, /event\.eventType === "check_in" \? "Turno iniciado" : "Turno finalizado"/);
  assert.match(provider, /newEntry\("check_in", organizationId, shiftId, "Inicio del turno"\)/);
});

test("B: without «Llegué» (EN_CAMINO on) the start offers it first; it never blocks", () => {
  assert.match(detail, /const offerArrival = enCamino && !arrivedHere;/);
  // Stored arrival, or one saved on the phone waiting for signal, counts as arrived.
  assert.match(detail, /Boolean\(verification\.arrivals\?\.length\) \|\| \(shiftId \? queuedJourneyState\(queue\.items, shiftId\)\.arrived : false\)/);
  assert.match(detail, /onClick=\{\(\) => \(offerArrival \? setArrivalPromptOpen\(true\) : void startShift\(\)\)\}/);
  // «Comenzar sin «Llegué»» starts the shift through the same queued check-in.
  assert.match(detail, /data-testid="start-without-arrival" onClick=\{\(\) => \{ setArrivalPromptOpen\(false\); void startShift\(\); \}\}/);
  assert.match(detail, /data-testid="go-to-arrival" onClick=\{goToArrival\}/);
  // The start button itself is not disabled by the arrival.
  assert.match(detail, /disabled=\{saving \|\| tooEarly\} onClick=\{\(\) => \(offerArrival/);
});

test("arrival and start stay independent records (no arrival written by the start)", () => {
  const start = detail.slice(detail.indexOf("async function startShift"), detail.indexOf("async function finishShift"));
  assert.match(start, /queue\.checkIn\(organizationId, shiftId\)/);
  assert.doesNotMatch(start, /recordArrival|arrival/i);
});

test("C: the agency sees «Inició sin «Llegué»» per caregiver, only where «Llegué» is offered", () => {
  assert.match(panel, /const arrivalOffered = hasOrgFeature\(activeOrganization\?\.features, "EN_CAMINO"\);/);
  assert.match(panel, /const arrivedMemberships = new Set\(arrivals\.map\(\(a\) => a\.membershipId\)\);/);
  assert.match(panel, /arrivalOffered && !\(e\.membershipId && arrivedMemberships\.has\(e\.membershipId\)\) && <span data-testid="started-without-arrival">/);
});

test("C: lateness measured from the start is worded as a start, not as an arrival", () => {
  assert.match(panel, /arrivals\.length \? `Llegó \$\{late\} min tarde` : `Inició \$\{late\} min tarde`/);
});

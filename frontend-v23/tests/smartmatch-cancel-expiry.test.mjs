import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const agency = read("src/pages/agency/AgencySmartMatchPage.tsx");
const caregiver = read("src/pages/caregiver/CaregiverSmartMatchPage.tsx");
const text = read("src/features/smartmatch/smartmatchText.ts");
const notes = read("src/api/notifications.ts");

test("agency: PUBLISHED and FILLED opportunities can be cancelled with a mandatory reason", () => {
  assert.match(agency, /\{\(opp\.status === "FILLED" \|\| opp\.status === "PUBLISHED"\) && <Button variant="ghost" onClick=\{\(\) => \{ setCancelReason\(""\); setCancelNote\(""\); setCancelTarget\(opp\); \}\}>Cancelar oportunidad<\/Button>\}/);
  assert.match(agency, /<Select label="Motivo" required/);
  assert.match(agency, /disabled=\{!cancelReason\}/);
  assert.match(agency, /Cada cuidadora recibirá un aviso con el motivo \(sin la nota interna\)/);
});

test("agency: auditable opportunity history (who, automatic, reason, closed applications)", () => {
  assert.match(agency, /listOpportunityHistory\(organizationId, opp\.id, token\)/);
  assert.match(agency, /ev\.automatic \? "Automático \(sistema\)"/);
  assert.match(text, /EXPIRED: "Vencida automáticamente"/);
});

test("caregiver: a closed application is explained, never shown as a rejection", () => {
  assert.match(text, /case "CLOSED": return closedReason === "OPPORTUNITY_EXPIRED"/);
  assert.match(caregiver, /no es una decisión sobre ti/);
  assert.doesNotMatch(caregiver, /cancellation_note/);
  assert.match(notes, /SMARTMATCH_APPLICATION_OPPORTUNITY_CANCELLED/);
  assert.match(notes, /SMARTMATCH_APPLICATION_OPPORTUNITY_EXPIRED/);
});

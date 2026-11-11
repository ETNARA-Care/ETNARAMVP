import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// 154 (11-nov-2026): las alertas de «Requiere atención» solo desaparecen cuando el problema se
// resuelve de verdad. Nada de botones que oculten una alerta en el navegador.
test("154: the attention list is still derived from the server, never hidden on the device", () => {
  const queue = read("src/pages/agency/overview/AttentionQueue.tsx");
  assert.match(queue, /const alerts = center \? sortAlerts\(center\.alerts\) : \[\];/);
  for (const file of ["src/pages/agency/overview/AttentionQueue.tsx", "src/features/shifts/ShiftAttentionPanel.tsx",
    "src/features/incidents/IncidentResolutionPanel.tsx", "src/pages/agency/AgencyOperationsPage.tsx"]) {
    assert.doesNotMatch(read(file), /localStorage|sessionStorage|dismiss|hiddenAlerts/i, file);
  }
  const model = read("src/pages/agency/overview/overviewModel.ts");
  assert.match(model, /alert\.title\.startsWith\("Turno terminado"\)\) return "Resolver turno"/);
  assert.match(model, /alert\.category === "open_incident"\) return "Resolver incidente"/);
});

test("154: an ended shift is closed with a reason and a mandatory note, or corrected through the audited path", () => {
  const api = read("src/api/shiftClosures.ts");
  assert.match(api, /\/close-without-service`/);
  assert.match(api, /\/verification\/omitted-visit-correction`/);
  for (const label of ["No hubo cuidador disponible", "La familia canceló el servicio", "El residente estaba ausente u hospitalizado", "El cuidador no se presentó", "Otro motivo"]) {
    assert.ok(api.includes(label), label);
  }
  assert.match(api, /closureNoteMin = \(reason: ClosureReason \| null\) => \(reason === "other" \? 20 : 10\)/);
  const panel = read("src/features/shifts/ShiftAttentionPanel.tsx");
  assert.match(panel, /sheetOnMobile/);
  assert.match(panel, /const ready = mode === "close" \? Boolean\(reason\) && trimmed >= min : Boolean\(membershipId\) && trimmed >= min;/);
  assert.match(panel, /con la hora de hoy<\/strong> \(no la de la visita\)/);
  assert.match(panel, /No cuenta como servicio prestado ni se factura/);
  assert.match(panel, /data-testid="closure-contradicted"/);
  const page = read("src/pages/agency/AgencyShiftDetailPage.tsx");
  assert.match(page, /const manager = roles\.includes\("ORGANIZATION_ADMIN"\) \|\| roles\.includes\("SUPERVISOR"\);/);
  // The 30-second refresh must not remount the sheet while the user is typing on the phone.
  assert.match(page, /<ShiftAttentionPanel key=\{shift\.status\}/);
});

test("154: incidents are resolved for real; serious ones explain what is missing instead of hiding the button", () => {
  const panel = read("src/features/incidents/IncidentResolutionPanel.tsx");
  assert.match(panel, /getIncidentResolutionRules/);
  assert.match(panel, /disabled=\{blockers\.length > 0\}/);
  assert.match(panel, /data-testid="serious-requirements"/);
  assert.match(panel, /Un incidente resuelto no se puede reabrir ni borrar\./);
  assert.match(read("src/pages/agency/AgencyIncidentDetailPage.tsx"), /<IncidentResolutionPanel organizationId=\{organizationId\} incident=\{incident\}/);
  const settings = read("src/pages/agency/AgencyOrganizationSettingsPage.tsx");
  assert.match(settings, /\{isOrgAdmin && organizationId && <IncidentClosersCard organizationId=\{organizationId\} \/>\}/);
});

test("154: closed pending items stay consultable (history)", () => {
  const app = read("src/App.tsx");
  assert.match(app, /<Route path="operations\/history" element=\{<AgencyClosedPendingsPage\/>\}\/>/);
  assert.match(read("src/pages/agency/AgencyOperationsPage.tsx"), /navigate\("\/agency\/operations\/history"\)/);
  const incidents = read("src/pages/agency/AgencyIncidentsPage.tsx");
  assert.match(incidents, /label: `Resueltos \(\$\{resolvedIncidents\.length\}\)`/);
  assert.match(read("src/pages/agency/AgencyClosedPendingsPage.tsx"), /navigate\("\/agency\/incidents\?tab=resolved"\)/);
});

test("154: billing explains a shift closed without service is not billed (es/en)", () => {
  assert.match(read("src/i18n/locales/es/billing.json"), /"SHIFT_CLOSED_WITHOUT_SERVICE": "Cerrado sin servicio en el Centro operacional: no se factura"/);
  assert.match(read("src/i18n/locales/en/billing.json"), /"SHIFT_CLOSED_WITHOUT_SERVICE": /);
});

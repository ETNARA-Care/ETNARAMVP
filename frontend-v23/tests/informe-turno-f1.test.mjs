import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const detail = read("src/pages/agency/AgencyShiftDetailPage.tsx");
const shifts = read("src/pages/agency/AgencyShiftsPage.tsx");
const view = read("src/features/shiftReports/ShiftReportView.tsx");
const panel = read("src/features/shiftReports/ShiftReportPanel.tsx");
const api = read("src/api/shiftReports.ts");

test("Informe de Turno F1 only where ETNARA central turned SHIFT_REPORTS on (agency only)", () => {
  assert.match(app, /<Route path="shift-reports" element=\{<FeatureRoute feature="SHIFT_REPORTS" fallback="\/agency"><AgencyShiftReportsPage\/><\/FeatureRoute>\}\/>/);
  assert.match(detail, /const shiftReports = hasOrgFeature\(activeOrganization\?\.features, "SHIFT_REPORTS"\);/);
  assert.match(detail, /\{shiftReports && organizationId && shiftId && shift\.care_recipient_id && <ShiftReportPanel/);
  assert.match(shifts, /\{shiftReports && \(\s*<Link to="\/agency\/shift-reports"/);
  assert.doesNotMatch(app, /caregiver\/[^"]*shift-report|family\/[^"]*shift-report/); // F2/F3 not built
  assert.match(read("src/features/platform/OrganizationFeaturesCard.tsx"), /SHIFT_REPORTS: \{ title: "Informe de turno"/);
});

test("the report shows records only; empty sections say so; free text untouched", () => {
  assert.match(view, /Sin registros de movilidad\./);
  assert.match(view, /Ninguno registrado durante el turno\./);
  assert.match(view, /ETNARA no añade actividades ni marca tareas como hechas/);
  assert.doesNotMatch(view, /carePlan|plan_details|pendiente/i);
  assert.match(view, /whitespace-pre-line">\{n\.text\}/); // caregiver text as written
  assert.doesNotMatch(view + panel, /\bt\(|i18n/); // module text stays es-PR until B3; user text is never translated
});

test("approval: stale-draft guard, ETNARA defaults, incidents and photos need express choice", () => {
  assert.match(panel, /expectedGeneratedAt: approving\.generatedAt/);
  assert.match(api, /schedule: true, meals: true, hydration: true, activities: true, mobility: true, observations: true,\s+hygiene: false, mood: false, incidents: false, photos: false/);
  assert.match(panel, /\(key === "incidents" \|\| key === "photos"\) \? " · requiere tu aprobación expresa"/);
  assert.match(panel, /\{report\.status === "DRAFT" && \(/); // actions only on drafts; approved is read-only
});

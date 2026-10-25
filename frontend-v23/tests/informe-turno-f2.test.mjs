import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const api = read("src/api/shiftReports.ts");
const list = read("src/pages/caregiver/CaregiverShiftReportsPage.tsx");
const review = read("src/pages/caregiver/CaregiverShiftReportPage.tsx");
const shifts = read("src/pages/caregiver/CaregiverShiftsPage.tsx");
const panel = read("src/features/shiftReports/ShiftReportPanel.tsx");
const agencyList = read("src/pages/agency/AgencyShiftReportsPage.tsx");
const bell = read("src/features/notifications/NotificationBell.tsx");
const notif = read("src/api/notifications.ts");

test("caregiver screens exist only behind SHIFT_REPORTS", () => {
  assert.match(app, /<Route path="shift-reports" element=\{<FeatureRoute feature="SHIFT_REPORTS" fallback="\/caregiver"><CaregiverShiftReportsPage\/><\/FeatureRoute>\}\/>/);
  assert.match(app, /<Route path="shift-reports\/:reportId" element=\{<FeatureRoute feature="SHIFT_REPORTS" fallback="\/caregiver"><CaregiverShiftReportPage\/><\/FeatureRoute>\}\/>/);
  assert.match(shifts, /const shiftReports = hasOrgFeature\(activeOrganization\?\.features, "SHIFT_REPORTS"\);/);
  assert.match(shifts, /\{shiftReports && <Link to="\/caregiver\/shift-reports"/);
});

test("the caregiver reads her own reports through /me endpoints only", () => {
  assert.match(api, /\$\{O\(org\)\}\/me\/shift-reports/);
  assert.match(list, /shiftReportsApi\.mine\(/);
  assert.match(review, /shiftReportsApi\.myReport\(/);
  assert.doesNotMatch(list + review, /shiftReportsApi\.(list|forShift|approve|refresh|returnToCaregiver)\(/);
});

test("review: records are read-only, one final observation, «Enviar a revisión» with confirmation", () => {
  assert.match(review, /<ShiftReportView content=\{report\.content\} \/>/);
  assert.match(review, /maxLength=\{1000\}/);
  assert.match(review, /Tus registros originales no cambian\./);
  assert.match(review, /Enviar a revisión/);
  assert.match(review, /data-testid="confirm-submit"/);
  assert.match(review, /\{report\.canEdit && \(/); // nothing editable after sending, after 24 h or once approved
  assert.match(review, /SHIFT_REPORT_WINDOW_CLOSED/);
  assert.doesNotMatch(review, /shiftReportsApi\.approve|Aprobar informe/); // she never approves
});

test("expired window: no deletion, the report stays for the agency", () => {
  assert.match(review, /Pasaron las 24 horas\. La agencia revisará este informe\./);
  assert.match(panel, /Plazo de la cuidadora vencido/);
  assert.doesNotMatch(review + panel, /\.delete\(|eliminar/i);
});

test("agency: sees the caregiver's note, can return while the window is open, approves sent, returned or expired drafts", () => {
  assert.match(panel, /data-testid="shift-report-caregiver-note"/);
  assert.match(panel, /report\.status === "SUBMITTED" && !report\.caregiverWindowExpired && !report\.ownVisit/);
  assert.match(panel, /disabled=\{!returnNote\.trim\(\)\}/); // a return always says why
  assert.match(panel, /\{report\.status !== "SUBMITTED" && <Button variant="secondary" icon=\{<RefreshCw/); // never refresh what she sent
  assert.match(agencyList, /\{ key: "PENDING", label: "Por aprobar" \}/);
  assert.match(agencyList, /Enviado por la cuidadora/);
});

test("in-portal notifications open her report", () => {
  assert.match(bell, /type === "SHIFT_REPORT_READY" \|\| type === "SHIFT_REPORT_RETURNED"\) && entityId\) \{ navigate\(`\/caregiver\/shift-reports\/\$\{entityId\}`\)/);
  assert.match(notif, /SHIFT_REPORT_READY"\) return "Tu informe de turno está listo para revisar"/);
});

test("module text stays es-PR (B3 not started); user text never translated", () => {
  assert.doesNotMatch(list + review, /\bt\(|i18n|useTranslation/);
  assert.match(review, /whitespace-pre-line text-sm text-\[var\(--color-text-secondary\)\]">\{returned\.note\}/);
});

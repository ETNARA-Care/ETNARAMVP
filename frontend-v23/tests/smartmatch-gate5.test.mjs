import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const bell = read("src/features/notifications/NotificationBell.tsx");
const notificationsApi = read("src/api/notifications.ts");
const overlay = read("src/components/ui/Overlay.tsx");
const app = read("src/App.tsx");
const scroll = read("src/components/ScrollToTop.tsx");
const overview = read("src/pages/agency/AgencyOverviewPage.tsx");
const panel = read("src/pages/agency/overview/SmartMatchPanel.tsx");
const agency = read("src/pages/agency/AgencySmartMatchPage.tsx");
const caregiver = read("src/pages/caregiver/CaregiverSmartMatchPage.tsx");
const text = read("src/features/smartmatch/smartmatchText.ts");

test("bell shows a numeric unread badge and can mark all as read", () => {
  assert.match(bell, /data-testid="notification-count"/);
  assert.match(bell, /unread > 9 \? "9\+" : unread/);
  assert.match(bell, /markAllRead\(\)/);
});

test("SmartMatch notifications open the exact application", () => {
  assert.match(bell, /SMARTMATCH_APPLICATION_SUBMITTED"\) navigate\(`\/agency\/smartmatch\?application=\$\{entityId\}`\)/);
  assert.match(bell, /navigate\(`\/caregiver\/smartmatch\?tab=mine&application=\$\{entityId\}`\)/);
  for (const t of ["SUBMITTED", "APPROVED", "REJECTED", "CLOSED"]) assert.ok(notificationsApi.includes(`SMARTMATCH_APPLICATION_${t}`), t);
  assert.match(agency, /searchParams\.get\("application"\)/);
  assert.match(agency, /searchParams\.get\("opportunity"\)/);
  assert.match(caregiver, /searchParams\.get\("tab"\) === "mine"/);
  assert.match(caregiver, /aria-current=\{app\.id === highlightId/);
});

test("dashboard SmartMatch panel is for administrators only and links to review", () => {
  assert.match(overview, /roles\.includes\("ORGANIZATION_ADMIN"\) && activeOrganization && <SmartMatchPanel/);
  for (const label of ["Pendientes", "Publicadas", "Cubiertas"]) assert.ok(panel.includes(`"${label}"`), label);
  assert.match(panel, /\/agency\/smartmatch\?opportunity=\$\{o\.id\}/);
  assert.doesNotMatch(code(panel), /care_recipient|patient|paciente/i);
});

test("mobile: route changes start at the top; modals fit the screen and clear the home bar", () => {
  assert.match(app, /<ScrollToTop\/>/);
  assert.match(scroll, /window\.scrollTo\(\{ top: 0/);
  assert.match(overlay, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(overlay, /overflow-y-auto/);
  assert.equal((overlay.match(/env\(safe-area-inset-bottom\)/g) ?? []).length, 2);
});

test("dates are formatted in Spanish without the numeric US style", () => {
  assert.match(text, /toLocaleString\("es-PR", \{\s*day: "numeric", month: "short"/);
  assert.doesNotMatch(code(text), /dateStyle/);
});

test("role field offers predefined options plus a validated 'Otro'", () => {
  const backend = ["Cuidador/a", "Acompañante", "Asistente de cuidado personal", "Cuidado nocturno", "Relevo (respiro familiar)"];
  for (const r of backend) assert.ok(text.includes(`"${r}"`), r);
  assert.match(agency, /<option value="Otro">Otro…<\/option>/);
  assert.match(agency, /form\.roleChoice === "Otro" \? form\.roleOther\.trim\(\)/);
  assert.match(text, /No incluyas nombres de personas/);
  assert.match(text, /No incluyas información del paciente/);
  assert.match(text, /No incluyas direcciones/);
});

const shiftsPage = read("src/pages/agency/AgencyShiftsPage.tsx");
const smApi = read("src/api/smartmatch.ts");
const shiftsApi = read("src/api/shifts.ts");
const instructionsCard = read("src/features/shifts/ShiftPrivateInstructions.tsx");

test("Turnos: approval offers 'Crear turno con esta cuidadora' and deferred state stays actionable", () => {
  assert.match(agency, /Crear turno con esta cuidadora/);
  assert.match(agency, /navigate\(`\/agency\/shifts\?create=1&smartmatch=\$\{opportunityId\}`\)/);
  assert.match(agency, /opp\.status === "FILLED" && !opp\.shift_id && <Button/);
  assert.match(text, /"Cubierta — pendiente de asignación"/);
  assert.match(text, /Turno creado/);
});

test("Turnos: the existing shifts page opens prefilled; schedule fixed; one server call", () => {
  assert.match(shiftsPage, /searchParams\.get\("smartmatch"\)/);
  assert.match(shiftsPage, /createShiftFromOpportunity\(organizationId, smartMatchId, \{ careRecipientId: smartMatchRecipientId, instructions \}/);
  assert.match(smApi, /\/opportunities\/\$\{id\(opportunityId\)\}\/shift`/);
  assert.doesNotMatch(smApi, /scheduledStart/);
  assert.match(shiftsPage, /disabled=\{saving \|\| !smartMatchDraft\?\.canCreate \|\| !smartMatchRecipientId\}/);
});

test("Turnos: private instructions are fetched from their own endpoint, read-only for caregivers", () => {
  assert.match(shiftsApi, /\/shifts\/\$\{shiftId\}\/private-instructions/);
  assert.match(read("src/pages/caregiver/CaregiverShiftDetailPage.tsx"), /<ShiftPrivateInstructions organizationId=\{organizationId\} shiftId=\{shiftId\} editable=\{false\} \/>/);
  assert.match(read("src/pages/agency/AgencyShiftDetailPage.tsx"), /<ShiftPrivateInstructions/);
  assert.match(instructionsCard, /if \(text === undefined \|\| \(!text && !editable\)\) return null;/);
  assert.doesNotMatch(read("src/pages/family/FamilyTodayPage.tsx"), /private-instructions|ShiftPrivateInstructions/);
});

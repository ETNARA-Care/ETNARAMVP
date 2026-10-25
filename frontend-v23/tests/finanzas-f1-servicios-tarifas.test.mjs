import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Finanzas route exists only behind FINANZAS and only for the administrator", () => {
  const app = read("src/App.tsx");
  assert.match(app, /<Route path="finance" element={<FeatureRoute feature="FINANZAS" fallback="\/agency"><AgencyFinancePage\/><\/FeatureRoute>}\/>/);
  const page = read("src/pages/agency/AgencyFinancePage.tsx");
  assert.match(page, /if \(!roles\.includes\("ORGANIZATION_ADMIN"\)\)/);
  const layout = read("src/layouts/AgencyLayout.tsx");
  assert.match(layout, /item\.to !== "\/agency\/timesheets" && item\.to !== "\/agency\/smartmatch" && item\.to !== "\/agency\/finance"/);
  assert.match(layout, /\(finance \|\| item\.to !== "\/agency\/finance"\)/);
  assert.match(read("src/auth/orgFeatures.tsx"), /export type OrgFeature = "SMARTMATCH" \| "EN_CAMINO" \| "FINANZAS";/);
});

test("money is handled as integer cents: no floats in the finance screens", () => {
  const files = readdirSync(new URL("../src/features/finance/", import.meta.url)).map((f) => `src/features/finance/${f}`);
  for (const f of [...files, "src/api/finance.ts", "src/pages/agency/AgencyFinancePage.tsx"]) {
    const src = read(f);
    assert.doesNotMatch(src, /parseFloat|toFixed\(|\* ?100\)/, f);
  }
  const money = read("src/features/finance/money.ts");
  assert.match(money, /export function parseDollars\(text: string\): number \| null/);
  assert.match(money, /Number\(match\[1\]\) \* 100 \+ Number\(\(match\[2\] \?\? ""\)\.padEnd\(2, "0"\)\)/);
});

test("billing and pay rates are presented separately, with client and caregiver exceptions", () => {
  const detail = read("src/features/finance/ServiceDetail.tsx");
  assert.match(detail, /title="Cobro al cliente"/);
  assert.match(detail, /title="Pago al cuidador"/);
  assert.match(detail, /label: "Precio especial por cliente", preset: \{ kind: "client", scope: "client"/);
  assert.match(detail, /label: "Excepción por cuidador", preset: \{ kind: "caregiver", scope: "caregiver"/);
  assert.match(detail, /label: "Tarifa de feriado"/);
  assert.match(detail, /Historial de precios/);
});

test("the gross margin is never presented as profit", () => {
  const page = read("src/pages/agency/AgencyFinancePage.tsx");
  assert.match(page, /no es ganancia neta/);
  assert.match(read("src/features/finance/ShiftFinancePanel.tsx"), /Margen bruto estimado: no incluye nómina/);
  for (const f of ["src/features/finance/ServicesTab.tsx", "src/features/finance/ServiceDetail.tsx", "src/features/finance/ShiftFinancePanel.tsx"]) {
    assert.doesNotMatch(read(f), /[Gg]anancia(?! neta)/, f);
  }
});

test("shift creation is unchanged: the service is saved with a separate admin-only call", () => {
  const shifts = read("src/pages/agency/AgencyShiftsPage.tsx");
  const createCall = shifts.slice(shifts.indexOf("const shift = await createShift("), shifts.indexOf("}, token);", shifts.indexOf("const shift = await createShift(")));
  assert.doesNotMatch(createCall, /serviceId/);
  assert.match(shifts, /if \(finance && serviceId\) \{/);
  assert.match(shifts, /financeApi\.setShift\(organizationId, shift\.id, \{ serviceId \}, token\)/);
  assert.match(shifts, /const finance = hasOrgFeature\(activeOrganization\?\.features, "FINANZAS"\) && roles\.includes\("ORGANIZATION_ADMIN"\);/);
  const detail = read("src/pages/agency/AgencyShiftDetailPage.tsx");
  assert.match(detail, /\{finance && organizationId && shiftId && <ShiftFinancePanel/);
});

test("«Tarifas del equipo» stays and points to Finanzas; overlapping periods get a clear message", () => {
  const ts = read("src/pages/agency/AgencyTimesheetsPage.tsx");
  assert.match(ts, /Tarifas del equipo/);
  assert.match(ts, /to="\/agency\/finance">Finanzas → Servicios y tarifas<\/Link>/);
  assert.match(ts, /code==="PAY_PERIOD_OVERLAP"/);
});

test("ETNARA central can switch FINANZAS, and unknown switches no longer break its card", () => {
  const card = read("src/features/platform/OrganizationFeaturesCard.tsx");
  assert.match(card, /FINANZAS: \{ title: "Finanzas"/);
  assert.match(card, /no ve importes ni datos financieros/);
  assert.match(card, /data\.features\.filter\(\(f\) => f\.code in LABELS\)/);
  assert.match(card, /data\.history\.filter\(\(h\) => h\.code in LABELS\)/);
});

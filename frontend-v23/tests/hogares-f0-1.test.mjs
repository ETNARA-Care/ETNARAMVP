// F0.1 (hogares, 25-nov-2026): «Horas del personal» sin facturación, terminología por modalidad y textos es/en.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const json = (path) => JSON.parse(read(path));
const load = async (path) => {
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
};
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const fill = (text, values) => text.replace(/{{(\w+)}}/g, (_, k) => values[k]);

const centralEs = json("src/i18n/locales/es/central.json");
const centralEn = json("src/i18n/locales/en/central.json");
const resEs = json("src/i18n/locales/es/residential.json");
const resEn = json("src/i18n/locales/en/residential.json");
const orgValues = (catalog, kind) => ({ orgThe: catalog.org[kind].the, orgThis: catalog.org[kind].this, orgThisCap: catalog.org[kind].thisCap, orgOf: catalog.org[kind].of });

test("Central en una agencia: el texto en español es exactamente el de antes de F0.1", () => {
  const before = {
    FINANZAS: "Servicios y tarifas de la agencia. ETNARA central solo enciende o apaga: no ve importes ni datos financieros.",
    FACTURACION: "Facturas de la agencia a sus clientes. Requiere Finanzas. ETNARA central solo enciende, apaga y designa al gestor de permisos: no ve facturas, tarifas ni importes.",
    SHIFT_REPORTS: "Informe de cada visita con sus registros reales, revisado y aprobado por la agencia. ETNARA central solo enciende o apaga: no ve el contenido de los informes.",
    PUSH_NOTIFICATIONS: "Avisos push de la agencia a las personas que los activen en su teléfono (texto general, sin nombres ni datos de salud). ETNARA central solo enciende o apaga: no ve los avisos ni los teléfonos.",
    CONTRACTS: "Contrato con ETNARA, firma electrónica de la representante designada y términos por función, solo en esta agencia. Necesita además el módulo de contratos encendido en el servidor; no publica documentos ni salta la aprobación jurídica. Apagarlo impide nuevas aceptaciones y no borra contratos ni constancias.",
    ACTIVITY_PHOTOS: "Fotos de los cuidadores, revisadas por la agencia antes de que las vea la familia, con consentimiento. ETNARA central solo enciende o apaga: no ve las fotos ni los consentimientos.",
  };
  const agency = orgValues(centralEs, "agency");
  for (const [k, text] of Object.entries(before)) assert.equal(fill(centralEs.labels[k].detail, agency), text, k);
  assert.equal(fill(centralEs.features.intro, agency), "Apagadas por defecto. Solo la agencia piloto las ve. Cada cambio pide un motivo y queda en el historial.");
  assert.equal(fill(centralEs.features.photosLegalHolds, agency), "Esta agencia tiene fotografías sujetas a una obligación legal de conservación. Al apagar el módulo se conservan, no se eliminan, y la administración de la agencia podrá seguir revisándolas o levantándolas.");
  assert.equal(fill(centralEs.features.confirmTitle, { action: "Activar", title: "Contratos", orgThis: agency.orgThis }), "Activar Contratos para esta agencia");
});

test("Central en un hogar o una práctica: ningún texto dice «agencia» (es) ni «agency» (en)", () => {
  for (const kind of ["home", "practice"]) {
    for (const [catalog, word] of [[centralEs, /agencia/i], [centralEn, /agency/i]]) {
      const values = orgValues(catalog, kind);
      const texts = [...Object.values(catalog.labels).map((l) => fill(l.detail, values)), ...Object.values(catalog.features).map((t) => fill(t, values))];
      for (const t of texts) assert.doesNotMatch(t, word, `${kind}: ${t}`);
    }
  }
  assert.equal(fill(centralEs.features.confirmTitle, { action: "Activar", title: "X", orgThis: centralEs.org.home.this }), "Activar X para este hogar");
});

test("Central: el tipo llega desde la lista de organizaciones; sin tipo se usa el texto de agencia", () => {
  const card = code("src/features/platform/OrganizationFeaturesCard.tsx");
  assert.match(card, /return type === "residential_establishment" \? "home" : type === "independent_provider" \? "practice" : "agency";/);
  assert.match(read("src/pages/platform/PlatformOrganizationsPage.tsx"), /<OrganizationFeaturesCard organizationId=\{selectedOrg\.id\} organizationType=\{selectedOrg\.type\}\/>/);
  assert.doesNotMatch(card, /agencia|"[A-ZÁÉÍÓÚ][a-záéíóúñ]+ [a-záéíóúñ]+/, "sin textos visibles escritos en el componente");
});

test("Panel del hogar y franja de demostración en español e inglés", () => {
  const panel = code("src/pages/agency/residential/ResidentialPanelPage.tsx");
  const banner = code("src/components/DemoEnvironmentBanner.tsx");
  assert.match(panel, /useTranslation\("residential"\)/);
  assert.doesNotMatch(panel, /Residentes|Módulos|hogar\b/);
  assert.match(banner, /\{t\("demoBanner"\)\}/);
  assert.equal(resEs.demoBanner, "Entorno de demostración — Datos ficticios");
  assert.equal(resEn.demoBanner, "Demo environment — Fictitious data");
  assert.match(resEn.panel.overLimit, /Nothing is blocked\./);
});

test("Horas del personal: el hogar ve otra página; la agencia conserva la suya sin cambios", () => {
  const agency = read("src/pages/agency/AgencyTimesheetsPage.tsx");
  assert.match(agency, /if\(isResidentialOrganization\(activeOrganization\)\)return <StaffHoursPage\/>;if\(!roles\.includes\("ORGANIZATION_ADMIN"\)\)return/);
  for (const kept of ["Tarifa a facturar por hora (USD)", "Facturación preparada", "Finanzas → Servicios y tarifas", "Exportar CSV"]) assert.ok(agency.includes(kept), kept);
  const layout = read("src/layouts/AgencyLayout.tsx");
  const groups = layout.slice(layout.indexOf("const GROUPS:"), layout.indexOf("/* 160 (PR B)"));
  assert.doesNotMatch(groups, /staffHours/, "el menú de la agencia no cambia");
  const res = layout.slice(layout.indexOf("const RESIDENTIAL_GROUPS"), layout.indexOf("/** Pestañas fijas"));
  assert.match(res, /item\.k === "timesheets" \? \{ \.\.\.item, k: "staffHours" \} : item/);
  assert.equal(json("src/i18n/locales/es/shell.json").agency.items.staffHours, "Horas del personal");
  assert.equal(json("src/i18n/locales/en/shell.json").agency.items.staffHours, "Staff hours");
});

test("Horas del personal: sin facturación, sin Finanzas, sin nómina; solo pago estimado con aviso", () => {
  const page = code("src/pages/agency/residential/StaffHoursPage.tsx");
  assert.doesNotMatch(page, /bill|Billing|factur|\/agency\/finance|deduction|payroll|nómina/i);
  assert.match(page, /saveStaffPayRate\(org, rate\.membership_id, Math\.round\(value \* 100\), token\)/);
  assert.doesNotMatch(page, /saveFinancialRate/);
  assert.match(page, /data-testid="staff-hours-estimate-notice"/);
  assert.match(page, /if \(!roles\.includes\("ORGANIZATION_ADMIN"\)\)/, "solo administración, como antes");
  assert.match(page, /r\.membership_status === "active" && r\.pay_rate_cents == null/, "solo falta la tarifa de pago");
  // Exportación de horas conservada, sin columna de facturación.
  assert.match(page, /csvLines\(\[\s*\[t\("staffHours\.csv\.worker"\), t\("staffHours\.csv\.approvedHours"\), t\("staffHours\.csv\.estimatedPay"\), t\("staffHours\.csv\.sheets"\)\]/);
  assert.match(resEs.staffHours.estimateNotice, /Los importes son estimados\. No constituyen nómina ni procesamiento de pagos/);
  assert.match(resEn.staffHours.estimateNotice, /Amounts are estimates\. They are not payroll or payment processing/);
  // Fuera del aviso (que dice lo que ETNARA NO hace), ningún texto habla de facturación, deducciones ni contribuciones.
  for (const catalog of [resEs.staffHours, resEn.staffHours]) {
    const { estimateNotice, ...rest } = catalog;
    assert.ok(estimateNotice);
    assert.doesNotMatch(JSON.stringify(rest), /factur|billing|invoice|deduc|contribu/i);
  }
  const api = read("src/api/timesheets.ts");
  assert.match(api, /export async function saveStaffPayRate\(org:string,id:string,payRateCents:number,token:string\)\{return apiClient\.put\(`\/organizations\/\$\{org\}\/financial-rates\/\$\{id\}`,\{payRateCents,currency:"USD"\},token\)\}/);
});

// ---- Revisión GPT (25-nov) ----------------------------------------------------------------------------------
test("Horas del personal: datos, acciones y exportación ligados a la organización activa (como el panel de F0)", () => {
  const page = code("src/pages/agency/residential/StaffHoursPage.tsx");
  assert.match(page, /useState<OrganizationScoped<StaffHoursData> \| null>\(null\)/);
  assert.match(page, /const request = latest\.current\.begin\(\);/);
  assert.match(page, /if \(!request\.isCurrent\(\)\) return;/, "una respuesta atrasada no escribe el estado");
  assert.match(page, /const current = scopedTo\(state, organizationId\);/);
  assert.match(page, /return \(\) => tracker\.invalidate\(\);/);
  // Las acciones usan la organización de los datos en pantalla y no recargan si cambió mientras tanto.
  assert.match(page, /const org = current\?\.organizationId;\s*if \(!token \|\| !org \|\| org !== activeOrgRef\.current\) return;/);
  assert.match(page, /if \(org === activeOrgRef\.current\) await load\(\);/);
  for (const call of ["reviewTimesheet(org,", "saveStaffPayRate(org,", "closePayPeriod(org,"]) assert.ok(page.includes(call), call);
  assert.doesNotMatch(page, /(reviewTimesheet|saveStaffPayRate|closePayPeriod)\(organizationId/);
  assert.match(page, /if \(!preview \|\| current\?\.organizationId !== activeOrgRef\.current\) return;/, "la exportación solo usa la organización activa");
  // Sin estados sueltos que puedan quedar de la organización anterior.
  assert.doesNotMatch(page, /useState<Timesheet\[\]>|useState<FinancialRate\[\]>|useState<PayPeriodPreview/);
});

test("Resumen del periodo: una fila por persona (membresía), no por nombre", () => {
  assert.match(read("src/api/timesheets.ts"), /export interface PayPeriodWorker \{ membershipId\?:string; workerName:string;/);
  assert.match(code("src/pages/agency/residential/StaffHoursPage.tsx"), /key=\{w\.membershipId \?\? w\.workerName\}/);
  assert.match(read("src/pages/agency/AgencyTimesheetsPage.tsx"), /key=\{w\.membershipId\?\?w\.workerName\}/);
});

test("CSV a salvo de fórmulas en las dos exportaciones de horas (hogar y agencia)", async () => {
  const { csvCell, csvLines } = await load("src/features/export/csv.ts");
  for (const evil of ["=HYPERLINK(\"http://x\",\"y\")", "+1+1", "-2+3", "@SUM(A1)", "\t=1", "\r=1", "  =1+1", "=cmd|' /C calc'!A0"]) {
    const cell = csvCell(evil);
    assert.ok(cell.startsWith(`"'`), `${JSON.stringify(evil)} → ${cell}`);
  }
  assert.equal(csvCell("Ana Ficticia"), `"Ana Ficticia"`);
  assert.equal(csvCell("64.00"), `"64.00"`);
  assert.equal(csvCell("-5.00"), `"-5.00"`, "un número negativo no se altera");
  assert.equal(csvCell('Dice "hola"'), `"Dice ""hola"""`);
  assert.equal(csvLines([["a", "=1"], ["2", "b"]]), `"a","'=1"\n"2","b"`);
  assert.match(read("src/pages/agency/AgencyTimesheetsPage.tsx"), /new Blob\(\[csvLines\(lines\)\]/);
  assert.doesNotMatch(read("src/pages/agency/AgencyTimesheetsPage.tsx"), /replaceAll\('"','""'\)/);
  assert.doesNotMatch(code("src/pages/agency/residential/StaffHoursPage.tsx"), /replaceAll/);
});

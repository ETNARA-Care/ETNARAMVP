import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const flatten = (obj, prefix = "") => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));

test("billing screens use the billing catalog (es/en): no hard-coded text, every key exists", () => {
  const es = new Map(flatten(JSON.parse(read("src/i18n/locales/es/billing.json"))));
  for (const file of ["src/features/billing/BillingTab.tsx", "src/features/platform/BillingManagerPanel.tsx"]) {
    const src = read(file);
    const jsxText = [...src.matchAll(/>\s*([^<>{}\n]*[A-Za-zÁÉÍÓÚáéíóúñ¿¡][^<>{}\n]*)\s*</g)].map((m) => m[1].trim()).filter((x) => x && !/^(Promise|void)$/.test(x)); // TS generics, not text
    assert.deepEqual(jsxText, [], file);
    assert.doesNotMatch(src, /label="[^"]+"/, file);
    for (const [, key] of src.matchAll(/\bt\("([\w.]+)"/g)) assert.ok(es.has(key), `missing billing:${key} (${file})`);
    for (const [, prefix] of src.matchAll(/\bt\(`([\w.]+)\.\$\{/g)) assert.ok([...es.keys()].some((k) => k.startsWith(`${prefix}.`)), `missing billing:${prefix}.* (${file})`);
  }
  assert.match(read("src/i18n/index.ts"), /"common", "auth", "shell", "billing"/);
});

test("premium notice is discreet: no price and no call to buy", () => {
  for (const lang of ["es", "en"]) {
    const premium = JSON.stringify(JSON.parse(read(`src/i18n/locales/${lang}/billing.json`)).premium);
    assert.doesNotMatch(premium, /\$|\d|precio|price|compra|buy|pagar|pay now/i, lang);
  }
  const tab = read("src/features/billing/BillingTab.tsx");
  assert.match(tab, /if \(!module\.enabled && !capabilities\.includes\("view"\)\) return <PremiumNotice \/>;/);
  assert.match(tab, /module\.readOnly && \(/);
});

test("permission buttons only for managers while the module is on; the backend still decides", () => {
  const tab = read("src/features/billing/BillingTab.tsx");
  assert.match(tab, /const canEdit = data\.canManage && data\.module\.enabled;/);
  assert.match(tab, /a\.capabilities\.includes\("view"\) \? await billingApi\.permissions/);
  assert.match(tab, /reason\.trim\(\)\.length < 3/);
  assert.match(tab, /sheetOnMobile/);
  assert.match(tab, /break-all/);
  assert.match(tab, /formatDate\(iso, lang/); // dates in the app language, PR time
  assert.doesNotMatch(tab, /toLocale\w*String\("es-PR"/);
});

test("ETNARA central: FACTURACION needs FINANZAS; the manager panel shows e-mails only and never finance data", () => {
  const card = read("src/features/platform/OrganizationFeaturesCard.tsx");
  assert.match(card, /FACTURACION: \{ title: "Facturación Premium"/);
  assert.match(card, /"FINANZAS", "FACTURACION"\]/);
  assert.match(card, /const blocked = f\.code === "FACTURACION" && !f\.enabled && !finanzasOn;/);
  assert.match(card, /disabled=\{saving \|\| blocked\}/);
  assert.match(card, /f\.code === "FACTURACION" && f\.enabled && finanzasOn && !pending && <BillingManagerPanel/);
  const panel = read("src/features/platform/BillingManagerPanel.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(panel, /financeApi|billingApi|cents|amount|invoice/i);
  assert.match(read("src/api/platformOrganizations.ts"), /admins: \{ membershipId: string; email: string; isManager: boolean \}\[\]/);
});

test("Finanzas page gets the Facturación tab; Finanzas tabs and margin note unchanged", () => {
  const page = read("src/pages/agency/AgencyFinancePage.tsx");
  assert.match(page, /\{ id: "billing", label: "Facturación" \}/);
  assert.match(page, /tab === "billing" && <BillingTab organizationId=\{organizationId\} \/>/);
  for (const id of ["services", "caregivers", "clients", "holidays"]) assert.match(page, new RegExp(`tab === "${id}" && <`));
  assert.match(page, /tab !== "billing" && <p/);
  assert.match(read("src/auth/orgFeatures.tsx"), /"FINANZAS" \| "FACTURACION"/);
});

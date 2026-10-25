import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const flatten = (obj, prefix = "") => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const FILES = ["InvoicesSection", "NewInvoiceWizard", "DraftView", "EligibleShifts", "TaxSection"].map((f) => `src/features/billing/${f}.tsx`);

test("F2.2 screens use the billing catalog: no hard-coded text, every key exists in es and en", () => {
  const es = new Map(flatten(JSON.parse(read("src/i18n/locales/es/billing.json"))));
  for (const file of FILES) {
    const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    const jsxText = [...src.matchAll(/>\s*([^<>{}\n]*[A-Za-zÁÉÍÓÚáéíóúñ¿¡][^<>{}\n]*)\s*</g)].map((m) => m[1].trim())
      .filter((x) => x && !/^(Promise|void|IVU ·|—)$/.test(x) && !/^[A-Z][A-Za-z]+$/.test(x) && !/^[:?]|\? \($/.test(x)); // ternaries between JSX, not text
    assert.deepEqual(jsxText, [], file);
    assert.doesNotMatch(src, /label="[^"]+"/, file);
    for (const [, key] of src.matchAll(/\bt\("([\w.]+)"/g)) assert.ok(es.has(key), `missing billing:${key} (${file})`);
  }
});

test("the journey Finanzas → Facturación → Nueva factura → cliente → turnos → revisar exists, and issuing is not offered yet", () => {
  const tab = read("src/features/billing/BillingTab.tsx");
  assert.match(tab, /<InvoicesSection organizationId=\{organizationId\} canDraft=\{capabilities\.includes\("draft"\)\}/);
  const wizard = read("src/features/billing/NewInvoiceWizard.tsx");
  for (const step of ["step === 1", "step === 2", "step === 3", "step === 4"]) assert.ok(wizard.includes(step));
  assert.match(wizard, /billingDraftsApi\.create\(/);
  assert.match(wizard, /billingDraftsApi\.addShifts\(/);
  const all = FILES.map(read).join("\n");
  assert.doesNotMatch(all, /\/issue|issueInvoice|emitir\(/i);
  assert.match(read("src/i18n/locales/es/billing.json"), /"ISSUING_NOT_AVAILABLE": "La emisión llega en la siguiente etapa"/);
});

test("every change sends the version shown; DRAFT_CHANGED reloads", () => {
  const view = read("src/features/billing/DraftView.tsx");
  assert.match(view, /expectedVersion: v/);
  assert.match(view, /code === "DRAFT_CHANGED"\) await load\(\)/);
});

test("nothing tax-related is preselected: manual lines and services require an explicit choice", () => {
  for (const f of ["DraftView", "TaxSection"]) {
    const src = read(`src/features/billing/${f}.tsx`);
    assert.match(src, /useState<TaxTreatment \| "">\(""\)/, f);
    assert.match(src, /<option value="">—<\/option>/, f);
  }
  assert.match(read("src/i18n/locales/es/billing.json"), /ETNARA no trae tasas ni exenciones/);
});

test("mobile: full-screen wizard and draft, sheets for reasons, long names wrap, totals always visible", () => {
  assert.match(read("src/features/billing/NewInvoiceWizard.tsx"), /fullScreenOnMobile/);
  const view = read("src/features/billing/DraftView.tsx");
  assert.match(view, /fullScreenOnMobile wide/);
  assert.match(view, /sheetOnMobile/);
  assert.match(view, /sticky bottom-0/);
  assert.match(read("src/features/billing/InvoicesSection.tsx"), /break-words/);
});

test("manual lines: the portal uses the backend limits ($100,000.00 per unit, 1,000 units) with a clear message", () => {
  const f = read("src/features/billing/billingFormat.ts");
  assert.match(f, /UNIT_PRICE_MAX_CENTS = 10_000_000/);
  assert.match(f, /QUANTITY_MAX_HUNDREDTHS = 100_000/);
  assert.match(f, /return cents <= UNIT_PRICE_MAX_CENTS \? cents : NaN;/);
  assert.match(f, /return q > 0 && q <= QUANTITY_MAX_HUNDREDTHS \? q : NaN;/);
  const view = read("src/features/billing/DraftView.tsx");
  assert.match(view, /t\("manual\.quantityInvalid"\)/);
  assert.match(view, /t\("manual\.priceInvalid"\)/);
});

test("D1/D4: segments show the real interval and the billed minutes; new exception codes have messages in es and en", () => {
  const es = JSON.parse(read("src/i18n/locales/es/billing.json"));
  const en = JSON.parse(read("src/i18n/locales/en/billing.json"));
  for (const c of ["TIMESHEETS_OVERLAP", "APPROVED_EXCEEDS_RECORDED", "REAL_TIMES_MISSING"]) assert.ok(es.exceptions[c] && en.exceptions[c], c);
  assert.match(es.draft.segmentLine, /reales · \{\{hours\}\} facturadas/);
  assert.match(read("src/features/billing/EligibleShifts.tsx"), /const rows = all\.filter\(\(r\) => r\.minutes > 0\)/);
});

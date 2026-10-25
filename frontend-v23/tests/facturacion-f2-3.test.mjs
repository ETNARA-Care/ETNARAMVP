import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const flatten = (obj, prefix = "") => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const FILES = ["DraftView", "InvoicesSection", "BillingSettingsSection", "BillingTab"].map((f) => `src/features/billing/${f}.tsx`);
const es = new Map(flatten(JSON.parse(read("src/i18n/locales/es/billing.json"))));
const en = new Map(flatten(JSON.parse(read("src/i18n/locales/en/billing.json"))));

test("F2.3 screens use the billing catalog; es and en have the same keys", () => {
  assert.deepEqual([...es.keys()].sort(), [...en.keys()].sort());
  for (const file of FILES) {
    const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(src, /label="[^"]+"/, file);
    for (const [, key] of src.matchAll(/\bt\("([\w.]+)"/g)) assert.ok(es.has(key), `missing billing:${key} (${file})`);
  }
  for (const k of ["issue.download.original", "issue.download.void_copy", "invoices.status.issued", "invoices.status.voided", "invoices.chips.issued", "invoices.chips.voided"]) assert.ok(es.has(k) && en.has(k), k);
});

test("every backend issuing error and blocker has a message", () => {
  for (const code of ["ISSUE_BLOCKED", "ALREADY_ISSUED", "ALREADY_VOIDED", "INVOICE_NOT_ISSUED", "NUMBER_CONFLICT", "INVOICE_IMMUTABLE", "CLAIM_INVOICED", "PREFIX_LOCKED",
    "NUMBER_NEVER_DECREASES", "HOLIDAY_INVOICED", "BILLING_STORAGE_NOT_CONFIGURED", "BILLING_STORAGE_UNAVAILABLE", "BILLING_DOCUMENT_INTEGRITY", "DOCUMENT_NOT_FOUND",
    "LOGO_TOO_LARGE", "LOGO_TYPE_NOT_ALLOWED", "LOGO_UNREADABLE", "REASON_REQUIRED"]) assert.ok(es.has(`errors.${code}`) && en.has(`errors.${code}`), code);
  for (const b of ["SETTINGS_INCOMPLETE", "TAX_CONFIG_NOT_VALIDATED", "STORAGE_NOT_CONFIGURED"]) assert.ok(es.has(`blockers.${b}`) && en.has(`blockers.${b}`), b);
});

test("issuing: only with billing.issue, confirmed, version sent; void needs a reason; nothing editable once issued", () => {
  const view = read("src/features/billing/DraftView.tsx");
  assert.match(view, /inv\.status === "draft" && canIssueCap/);
  assert.match(view, /disabled=\{!data\.canIssue \|\| busy\}/);
  assert.match(view, /dialog\?\.kind === "issue"/);
  assert.match(view, /billingIssueApi\.issue\(organizationId, inv\.id, \{ expectedVersion: v \}/);
  assert.match(view, /data\.canVoid &&/);
  assert.match(view, /<ReasonDialog title=\{t\("issue\.voidTitle"[^]*?required busy/);
  assert.match(read("src/features/billing/BillingTab.tsx"), /canIssue=\{capabilities\.includes\("issue"\)\}/);
  assert.match(read("src/features/billing/InvoicesSection.tsx"), /canIssueCap=\{canIssue && !readOnly\}/);
});

test("PDF and logo are read with the session: no public or signed links, no caching", () => {
  const client = read("src/api/client.ts");
  assert.match(client, /async function getBinary\(path:string,token:string\)/);
  assert.match(client, /Authorization:`Bearer \$\{token\}`\},cache:"no-store"/);
  const api = read("src/api/billing.ts");
  assert.match(api, /apiClient\.getBinary\(`\$\{base\(org\)\}\/invoices\/\$\{encodeURIComponent\(id\)\}\/pdf\?kind=\$\{kind\}`, token\)/);
  const all = FILES.map(read).join("\n");
  assert.doesNotMatch(all, /signedUrl|presign|window\.open\(/i);
  assert.match(read("src/features/billing/DraftView.tsx"), /URL\.revokeObjectURL\(url\)/);
});

test("tax: nothing preloaded; validating needs an explicit check and a note; the CPA notice is shown", () => {
  const s = read("src/features/billing/BillingSettingsSection.tsx");
  assert.match(s, /const ok = note\.trim\(\)\.length >= 3 && \(!validate \|\| confirmed\)/);
  assert.match(s, /useState\(false\)/);
  assert.match(es.get("settings.taxBody"), /ETNARA no trae tasas ni exenciones/);
  assert.doesNotMatch(s, /1150|11\.5|10\.5/);
});

test("settings: only billing.manage edits; prefix rule matches the backend and locks after the first invoice; retention ≥ 6", () => {
  const s = read("src/features/billing/BillingSettingsSection.tsx");
  assert.match(s, /\/\^\[A-Z0-9\]\{1,6\}\$\//);
  assert.match(s, /disabled=\{!canManage \|\| data\.series\.locked\}/);
  assert.match(s, /years >= 6 && years <= 30/);
  assert.match(s, /if \(!data\.series\.locked && prefix !== data\.series\.prefix\) body\.prefix = prefix/);
  assert.match(s, /\["image\/png", "image\/jpeg"\]\.includes\(file\.type\)/);
  assert.match(s, /LOGO_MAX_BYTES = 300 \* 1024/);
  assert.match(read("src/features/billing/BillingTab.tsx"), /<BillingSettingsSection organizationId=\{organizationId\} canManage=\{capabilities\.includes\("manage"\) && module\.enabled\}/);
});

test("older backend: the settings section hides on 404 and issued fields are optional", () => {
  assert.match(read("src/features/billing/BillingSettingsSection.tsx"), /status === 404\) \{ setUnsupported\(true\)/);
  assert.match(read("src/api/billing.ts"), /numberText\?: string \| null; issueDate\?: string \| null; totalCents\?: number \| null;/);
});

test("mobile: long names and numbers wrap, dialogs are sheets", () => {
  const view = read("src/features/billing/DraftView.tsx");
  assert.match(view, /data-invoice-final=\{inv\.status\}/);
  assert.match(view, /title=\{t\("issue\.confirmTitle"\)\} sheetOnMobile/);
  assert.match(read("src/features/billing/BillingSettingsSection.tsx"), /sheetOnMobile/);
  assert.match(read("src/features/billing/InvoicesSection.tsx"), /break-words/);
});

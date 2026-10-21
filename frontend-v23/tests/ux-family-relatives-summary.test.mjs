import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("family layout provides the relative selection and switcher", () => {
  const layout = read("src/layouts/FamilyLayout.tsx");
  assert.match(layout, /<FamilyRecipientProvider>/);
  assert.match(layout, /<FamilyRecipientSwitcher \/>/);
  const context = read("src/features/family/FamilyRecipientContext.tsx");
  assert.match(context, /listMyCareRecipients/);
  assert.match(context, /recipients\.length < 2\) return null/);
  assert.doesNotMatch(context, /localStorage|sessionStorage/);
});

test("family pages use the selected relative instead of always the first", () => {
  for (const page of ["FamilyTodayPage", "FamilyHistoryPage", "FamilySupportPages"]) {
    const source = read(`src/pages/family/${page}.tsx`);
    assert.match(source, /pickRecipient\(recipients, activeOrganization\?\.id, selectedKey\)/, page);
    assert.match(source, /\[activeOrganization, selectedKey\]/, page);
    assert.doesNotMatch(source, /\?\? recipients\[0\] : recipients\[0\]/, page);
  }
});

test("daily summary only restates what the family-safe timeline contains", () => {
  const summary = read("src/features/family/dailySummary.ts");
  assert.match(summary, /item\.type === "MOBILITY" \|\| item\.type === "ACTIVITY"/);
  assert.doesNotMatch(summary, /TOILETING/);
  assert.doesNotMatch(summary, /comió bien|está bien|excelente/i);
  const today = read("src/pages/family/FamilyTodayPage.tsx");
  assert.match(today, /buildDailySummary\(entries\)/);
  assert.match(today, /Resumen de hoy/);
});

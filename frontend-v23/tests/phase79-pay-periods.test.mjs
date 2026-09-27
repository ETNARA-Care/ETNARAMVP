import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 7.9 keeps pay-period preview, close and history on real APIs", () => {
  const api = read("src/api/timesheets.ts");
  const page = read("src/pages/agency/AgencyTimesheetsPage.tsx");

  for (const contract of ["previewPayPeriod", "closePayPeriod", "listPayPeriods"])
    assert.match(api, new RegExp(contract));
  assert.match(api, /pay-periods\/preview/);
  assert.match(api, /pay-periods\/close/);
  assert.match(page, /Cerrar periodo/);
  assert.match(page, /Periodos cerrados/);
  assert.match(page, /Promise\.allSettled/);
  assert.doesNotMatch(api, /DemoStore|localStorage/);
});

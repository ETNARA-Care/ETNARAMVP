import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const api = read("src/api/shiftReports.ts");
const client = read("src/api/client.ts");
const pages = read("src/pages/family/FamilyShiftReportsPage.tsx");
const view = read("src/features/shiftReports/FamilyShiftReportView.tsx");
const history = read("src/pages/family/FamilyHistoryPage.tsx");

test("family screens only behind SHIFT_REPORTS", () => {
  assert.match(app, /<Route path="shift-reports" element=\{<FeatureRoute feature="SHIFT_REPORTS" fallback="\/family"><FamilyShiftReportsPage\/><\/FeatureRoute>\}\/>/);
  assert.match(app, /<Route path="shift-reports\/:reportId" element=\{<FeatureRoute feature="SHIFT_REPORTS" fallback="\/family"><FamilyShiftReportPage\/><\/FeatureRoute>\}\/>/);
  assert.match(history, /\{hasOrgFeature\(activeOrganization\?\.features, "SHIFT_REPORTS"\) && \(\s*<Link to="\/family\/shift-reports"/);
});

test("the family reads only its own relative's approved reports through the family endpoints", () => {
  assert.match(api, /\/organizations\/\$\{org\}\/care-recipients\/\$\{recipient\}\/shift-reports/);
  assert.match(pages, /familyShiftReportsApi\.(list|get)\(recipient\.organizationId, recipient\.recipientId/);
  assert.doesNotMatch(pages + view, /shiftReportsApi\.(list|forShift|approve|mine|myReport)\(/);
  assert.match(api, /status: "APPROVED"/);
});

test("the view renders only what the server sent: no fallback content, no extra sections", () => {
  assert.match(view, /if \(!items\) return null;/);
  assert.match(view, /\{s\.schedule && \(/);
  assert.match(view, /\{s\.incidents && \(/);
  assert.doesNotMatch(view, /proximity|recordedOffline|photos|careEventId/);
  assert.match(view, /Solo ves las secciones que la agencia compartió contigo\./);
});

test("PDF: authenticated download, never remembered or cached, temporary in-memory link", () => {
  assert.match(client, /async function getBinary\(path:string,token:string\)/); // shared with Facturación F2.3
  assert.match(api, /apiClient\.getBinary\(/);
  assert.match(client, /cache:"no-store"/);
  const blobFn = client.slice(client.indexOf("async function getBinary"), client.indexOf("\n", client.indexOf("async function getBinary")));
  assert.ok(blobFn.length > 0 && !/lastResponses|rememberedListener/.test(blobFn)); // never kept in the offline memory
  assert.match(pages, /URL\.createObjectURL/);
  assert.match(pages, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 60_000\)/);
  assert.match(pages, /a\.download = `informe-de-turno-\$\{report\.serviceDate\}-\$\{report\.id\.slice\(0, 8\)\}\.pdf`/);
  assert.doesNotMatch(pages, /localStorage|sessionStorage|indexedDB|window\.open\(/);
});

test("module text stays es-PR (B3 not started); user text never translated", () => {
  assert.doesNotMatch(pages + view, /\bt\(|i18n|useTranslation/);
});

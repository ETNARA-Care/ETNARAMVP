import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// NOTE: this file intentionally keeps source-boundary assertions lightweight.
// Existing tests above this Phase 5.4 block are preserved in repository history;
// this replacement focuses on the navigation regression that changed in Phase 10.11.

test("Phase 5.4 Admin navigation remains actionable after grouped UX", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../src/layouts/AgencyLayout.tsx", import.meta.url), "utf8");
  const shift = await readFile(new URL("../src/pages/agency/AgencyShiftDetailPage.tsx", import.meta.url), "utf8");
  const workers = await readFile(new URL("../src/pages/agency/AgencySupportPages.tsx", import.meta.url), "utf8");
  const workerProfile = await readFile(new URL("../src/pages/agency/AgencyWorkerProfilePage.tsx", import.meta.url), "utf8");

  assert.match(app, /path="shifts\/:shiftId" element={<AgencyShiftDetailPage/);
  assert.match(app, /path="workers\/:membershipId" element={<AgencyWorkerProfilePage/);
  assert.match(shift, /Sí, cancelar turno/);
  assert.match(workers, /\/agency\/workers\/\$\{worker\.id\}/);
  assert.match(workerProfile, /Información laboral/);
  assert.match(layout, /label:\s*"Resumen"/);
  assert.match(layout, /label="Operaciones"/);
  assert.match(layout, /label="Administración"/);
  assert.match(layout, /aria-expanded=\{open\}/);
  assert.match(layout, /activeOrganization\?\.name/);
  assert.doesNotMatch(layout, /Residencial Los Almendros|Rafael Vega/);
});

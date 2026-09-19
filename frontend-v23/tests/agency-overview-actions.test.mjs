import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Administration Overview provides actionable navigation", () => {
  const overview = read("src/pages/agency/AgencyOverviewPage.tsx");
  assert.match(overview, /Acciones rápidas/);
  assert.match(overview, /\/agency\/shifts\?create=1/);
  assert.match(overview, /\/agency\/residents/);
  assert.match(overview, /\/agency\/workers/);
  assert.match(overview, /\/agency\/incidents/);
  assert.match(overview, /DashboardAction/);
});

test("the create-turn Overview action opens the real shift workflow", () => {
  const shifts = read("src/pages/agency/AgencyShiftsPage.tsx");
  assert.match(shifts, /useSearchParams/);
  assert.match(shifts, /useState\(\(\) => searchParams\.get\("create"\) === "1"\)/);
});

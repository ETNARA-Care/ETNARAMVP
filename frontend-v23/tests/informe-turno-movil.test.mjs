import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const fmt = read("src/features/shiftReports/reportFormat.ts");
const view = read("src/features/shiftReports/ShiftReportView.tsx");
const chip = read("src/features/shiftReports/StatusChip.tsx");
const cgList = read("src/pages/caregiver/CaregiverShiftReportsPage.tsx");
const agList = read("src/pages/agency/AgencyShiftReportsPage.tsx");

// The same rules as reportFormat.ts, executed (the module is TS; logic kept tiny on purpose).
const TZ = "America/Puerto_Rico";
const keep = (s) => s.replace(/[\s\u202f]+/g, "\u00a0");
const time = (v) => keep(new Date(v).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit", timeZone: TZ }));
const dayKey = (v) => new Date(v).toLocaleDateString("en-CA", { timeZone: TZ });

test("times never break inside «a. m.» / «p. m.»", () => {
  assert.match(fmt, /const keep = \(s: string\) => s\.replace\(\/\[\\s\\u202f\]\+\/g, "\\u00a0"\);/);
  assert.match(fmt, /export const reportTime = \(v: string\) => keep\(/);
  assert.ok(!/\s/.test(time("2026-10-24T01:44:00Z").replace(/\u00a0/g, "")), "only non-breaking spaces");
});

test("a time on another day than the shift shows its date (visits can cross midnight)", () => {
  assert.equal(dayKey("2026-10-24T01:44:00Z"), "2026-10-23"); // 9:44 p. m. PR on the 23rd
  assert.notEqual(dayKey("2026-10-24T01:44:00Z"), dayKey("2026-10-25T01:10:00Z"));
  assert.match(fmt, /export const otherDay = \(at: string, refDay\?: string \| null\) => \(refDay && reportDayKey\(at\) !== refDay \? reportDayMonth\(at\) : null\);/);
  assert.match(view, /const refDay = reportDayKey\(content\.shift\.scheduledStart\);/);
  assert.equal((view.match(/<Moment at=\{/g) ?? []).length, 4); // arrival, start, end, scheduled end
  assert.equal((view.match(/refDay=\{refDay\}/g) ?? []).length >= 10, true); // every record row
});

test("cards: full names (no truncation), status on its own line, compact dates", () => {
  for (const page of [cgList, agList]) {
    assert.doesNotMatch(page, /truncate/);
    assert.match(page, /min-w-0 break-words font-medium/);
    assert.match(page, /<StatusChip /);
    assert.match(page, /reportShortDate\(r\.scheduledStart\)/);
  }
  assert.match(chip, /max-w-full/);
  assert.doesNotMatch(chip, /uppercase/);
});

test("no data or status change: only presentation", () => {
  assert.doesNotMatch(cgList + agList + view, /shiftReportsApi\.(approve|submitMine|setMyObservation|refresh|returnToCaregiver)\(/);
});

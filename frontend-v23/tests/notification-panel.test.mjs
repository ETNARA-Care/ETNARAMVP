import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { notificationTime as raw } from "../src/features/notifications/notificationTime.ts";
// ICU separates "p. m." with narrow no-break spaces; compare as plain spaces.
const notificationTime = (...a) => raw(...a).replace(/[\u00a0\u202f]/g, " ");

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const now = new Date("2026-10-24T22:00:00-04:00");

test("dates in Spanish (Puerto Rico time), never a huge number of hours", () => {
  assert.equal(notificationTime("2026-10-24T21:59:40-04:00", now), "ahora");
  assert.equal(notificationTime("2026-10-24T21:20:00-04:00", now), "hace 40 min");
  assert.equal(notificationTime("2026-10-24T08:00:00-04:00", now), "hace 14 h");
  assert.equal(notificationTime("2026-10-23T15:15:00-04:00", now), "ayer, 3:15 p. m.");
  assert.equal(notificationTime("2026-10-20T09:00:00-04:00", now), "martes, 9:00 a. m.");
  assert.equal(notificationTime("2026-10-02T09:00:00-04:00", now), "2 de octubre");
  assert.equal(notificationTime("2025-12-31T23:00:00-04:00", now), "31 de diciembre de 2025");
  // Days follow the Puerto Rico calendar: just after midnight, 23:30 is already «ayer».
  assert.equal(notificationTime("2026-10-24T23:30:00-04:00", new Date("2026-10-25T00:30:00-04:00")), "ayer, 11:30 p. m.");
  assert.equal(notificationTime("2026-10-24T20:00:00-04:00", new Date("2026-10-25T00:30:00-04:00")), "ayer, 8:00 p. m.");
  for (const hours of [30, 100, 240, 2000]) {
    assert.doesNotMatch(notificationTime(new Date(now.getTime() - hours * 3_600_000).toISOString(), now), /hace \d+ h/);
  }
});

test("phone layout: panel pinned inside the screen; admin header keeps the bell at the right edge", () => {
  const bell = read("../src/features/notifications/NotificationBell.tsx");
  assert.match(bell, /className="fixed inset-x-3 top-\[calc\(env\(safe-area-inset-top\)\+4\.25rem\)\]/);
  assert.match(bell, /sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-\[320px\]/);
  assert.doesNotMatch(bell, /w-\[320px\] max-w-\[85vw\]/);
  assert.match(bell, /notificationTime\(n\.createdAt, new Date\(\), language\)/);
  const admin = read("../src/layouts/admin/AdminTopbar.tsx");
  assert.match(admin, /<div className="flex-1 sm:hidden" aria-hidden \/>\s*<NotificationBell \/>/);
});

test("same component and same links in the three portals", () => {
  for (const f of ["../src/layouts/admin/AdminTopbar.tsx", "../src/layouts/FamilyLayout.tsx", "../src/layouts/CaregiverLayout.tsx"]) {
    assert.match(read(f), /import \{ NotificationBell \} from "@\/features\/notifications\/NotificationBell";/);
  }
  const bell = read("../src/features/notifications/NotificationBell.tsx");
  for (const route of ["/agency/smartmatch?application=", "/agency/shifts/${shiftId}", "/family/activity", "/caregiver/profile#my-credentials", "/agency/operations"]) assert.ok(bell.includes(route), route);
});

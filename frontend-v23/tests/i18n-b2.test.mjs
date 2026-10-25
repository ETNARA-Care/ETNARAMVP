import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { notificationTime } from "../src/features/notifications/notificationTime.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const SHELL = [
  "src/layouts/AgencyLayout.tsx", "src/layouts/CaregiverLayout.tsx", "src/layouts/FamilyLayout.tsx", "src/layouts/PlatformLayout.tsx",
  "src/layouts/AccountMenu.tsx", "src/layouts/PortalBottomNav.tsx", "src/layouts/admin/AdminTopbar.tsx", "src/layouts/admin/AdminSidebar.tsx",
  "src/layouts/admin/AdminMobileNav.tsx", "src/features/notifications/NotificationBell.tsx", "src/components/ui/Feedback.tsx",
  "src/components/ui/Overlay.tsx", "src/components/ui/Toast.tsx", "src/components/ui/Badge.tsx", "src/auth/ProtectedRoute.tsx",
];
const BRAND = /^(ETNARA( Care)?|Care|SmartMatch|Compliance|ETNARA Tower|Tower|Promise)$/; // brand names; "Promise" = TS generic, not text

test("B2: the portals' shared structure has no hard-coded visible text left", () => {
  for (const file of SHELL) {
    const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const jsxText = [...src.matchAll(/>\s*([^<>{}\n]*[A-Za-zÁÉÍÓÚáéíóúñ¿¡][^<>{}\n]*?)\s*</g)].map((m) => m[1].trim()).filter((t) => t && !BRAND.test(t) && !/[=;(]|=>/.test(t));
    assert.deepEqual(jsxText, [], `${file}: ${jsxText.join(" | ")}`);
    const attrs = [...src.matchAll(/\b(?:label|aria-label|title|roleLabel|userLabel)=\s*"([^"]+)"/g)].map((m) => m[1]).filter((t) => !BRAND.test(t));
    assert.deepEqual(attrs, [], `${file}: ${attrs.join(" | ")}`);
    const labelProps = [...src.matchAll(/\blabel: "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(labelProps, [], `${file}: ${labelProps.join(" | ")}`);
  }
});

test("B2: the language selector is in the account menu (three portals) and in ETNARA Central", () => {
  assert.match(read("src/layouts/AccountMenu.tsx"), /<LanguageSwitcher tone="light" \/>/);
  for (const f of ["src/layouts/admin/AdminTopbar.tsx", "src/layouts/CaregiverLayout.tsx", "src/layouts/FamilyLayout.tsx"]) assert.match(read(f), /<AccountMenu|AccountMenu /);
  assert.match(read("src/layouts/PlatformLayout.tsx"), /<LanguageSwitcher /);
});

test("B2: navigation keeps its routes and permission filters; only the wording moved to the catalog", () => {
  const agency = read("src/layouts/AgencyLayout.tsx");
  for (const to of ["/agency", "/agency/compliance", "/agency/workers", "/agency/shifts", "/agency/smartmatch", "/agency/planning", "/agency/timesheets", "/agency/finance", "/agency/operations", "/agency/residents", "/agency/quality", "/agency/incidents", "/agency/messages", "/agency/agents", "/agency/settings"]) assert.ok(agency.includes(`to: "${to}"`), to);
  assert.match(agency, /roles\.includes\("ORGANIZATION_ADMIN"\) \|\| \(item\.to !== "\/agency\/timesheets" && item\.to !== "\/agency\/smartmatch" && item\.to !== "\/agency\/finance"\)/);
  // Status badges translate the display only; the API value is the lookup key.
  assert.match(read("src/components/ui/Badge.tsx"), /t\(`status\.\$\{cfg\.labelKey\}`\)/);
});

test("B2: notification times in English too, Puerto Rico calendar", () => {
  const now = new Date("2026-10-24T22:00:00-04:00");
  const n = (s) => s.replace(/[  ]/g, " ");
  assert.equal(notificationTime("2026-10-24T21:59:40-04:00", now, "en"), "just now");
  assert.equal(notificationTime("2026-10-24T21:20:00-04:00", now, "en"), "40 min ago");
  assert.equal(notificationTime("2026-10-24T08:00:00-04:00", now, "en"), "14 h ago");
  assert.equal(n(notificationTime("2026-10-23T15:15:00-04:00", now, "en")), "yesterday, 3:15 PM");
  assert.equal(n(notificationTime("2026-10-20T09:00:00-04:00", now, "en")), "Tuesday, 9:00 AM");
  assert.equal(notificationTime("2026-10-02T09:00:00-04:00", now, "en"), "October 2");
  assert.equal(notificationTime("2025-12-31T23:00:00-04:00", now, "en"), "December 31, 2025");
  assert.equal(notificationTime("2026-10-24T21:20:00-04:00", now), "hace 40 min"); // Spanish stays the default
});

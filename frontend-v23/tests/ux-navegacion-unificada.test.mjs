import { shellEs } from "./_shellCatalog.mjs";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const nav = read("src/layouts/PortalBottomNav.tsx");
const menu = read("src/layouts/AccountMenu.tsx");
const admin = read("src/layouts/admin/AdminMobileNav.tsx");
const topbar = read("src/layouts/admin/AdminTopbar.tsx");
const caregiver = read("src/layouts/CaregiverLayout.tsx");
const family = read("src/layouts/FamilyLayout.tsx");

test("one bottom bar for the three portals, with the Administrative measures and Safari safe area", () => {
  assert.match(nav, /pb-\[env\(safe-area-inset-bottom,0px\)\]/);
  assert.match(nav, /<t\.icon size=\{21\} strokeWidth=\{isActive \? 2 : 1\.6\}/);
  assert.match(nav, /text-\[0\.6875rem\]/);
  assert.match(nav, /bg-\[var\(--color-success-700\)\]/);
  for (const layout of [admin, caregiver, family]) assert.match(layout, /<PortalBottomNav /);
  assert.equal(existsSync(new URL("../src/layouts/MobileTabBar.tsx", import.meta.url)), false);
});

test("each portal keeps its own sections and routes", () => {
  // i18n (B2): labels come from the shell catalog; the Spanish wording is unchanged.
  for (const [to, key, label] of [["/caregiver/today", "today", "Mi día"], ["/caregiver/shifts", "shifts", "Turnos"], ["/caregiver/messages", "messages", "Mensajes"], ["/caregiver/profile", "more", "Más"]]) {
    assert.match(caregiver, new RegExp(`to: "${to}", icon: \\w+, label: t\\("caregiver\\.items\\.${key}"\\)`));
    assert.equal(shellEs(`caregiver.items.${key}`), label);
  }
  for (const [to, key, label] of [["/family/today", "home", "Inicio"], ["/family/activity", "care", "Cuidado"], ["/family/history", "calendar", "Calendario"], ["/family/messages", "messages", "Mensajes"], ["/family/profile", "more", "Más"]]) {
    assert.match(family, new RegExp(`to: "${to}", icon: \\w+, label: t\\("family\\.items\\.${key}"\\)`));
    assert.equal(shellEs(`family.items.${key}`), label);
  }
  assert.match(admin, /label: t\("actions\.more", \{ ns: "common" \}\), onClick: \(\) => setSheet\(true\)/);
});

test("account menu in the header of the three portals: Configuración and Cerrar sesión", () => {
  assert.match(menu, /\{t\("account\.settings"\)\}/); assert.equal(shellEs("account.settings"), "Configuración");
  assert.match(menu, /t\("account\.logout"\)/); assert.equal(shellEs("account.logout"), "Cerrar sesión");
  assert.match(topbar, /<AccountMenu userLabel=\{userLabel\} roleLabel=\{t\("roles\.admin"\)\} settingsTo="\/agency\/settings"/);
  assert.match(caregiver, /settingsTo="\/caregiver\/profile"/);
  assert.match(family, /settingsTo="\/family\/profile"/);
  // Family header keeps the logo and the bell, plus the avatar.
  assert.match(family, /etnara-mark\.svg/);
  assert.match(family, /<NotificationBell \/>\s+<AccountMenu/);
});

test("caregiver logout warns when unsent records would be lost", () => {
  assert.match(caregiver, /logoutWarning=\{pending > 0 \?/);
  assert.match(menu, /if \(logoutWarning && !confirming\) \{ setConfirming\(true\); return; \}/);
});

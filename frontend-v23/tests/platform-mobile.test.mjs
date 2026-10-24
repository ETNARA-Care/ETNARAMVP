import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Button sizes are lengths, never ambiguous text-[var(--…)] (Tailwind v4 reads those as a color)", () => {
  const button = read("src/components/ui/Button.tsx");
  const sizes = button.slice(button.indexOf("const sizeClasses"), button.indexOf("};", button.indexOf("const sizeClasses")));
  assert.doesNotMatch(sizes, /text-\[var\(/);
  assert.match(sizes, /md: "h-11 px-4 text-\[length:1rem\]/);
  assert.match(sizes, /sm: "h-10 /);
});

test("Modal body uses flex-auto (Safari collapses a 0% basis in a max-height column) and offers a phone sheet", () => {
  const overlay = read("src/components/ui/Overlay.tsx");
  assert.match(overlay, /min-h-0 flex-auto overflow-y-auto/);
  assert.doesNotMatch(overlay, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(overlay, /sheetOnMobile/);
  assert.match(overlay, /max-h-\[92dvh\]/);
});

test("ETNARA central defines the sage palette its screens use", () => {
  const theme = read("src/styles/platform-theme.css");
  for (const step of ["50", "100", "200", "300", "600", "700", "800"]) assert.match(theme, new RegExp(`--color-sage-${step}:`));
  assert.match(read("src/main.tsx"), /platform-theme\.css/);
});

test("phones get a bottom navigation; the header tabs stay for md+ only", () => {
  const layout = read("src/layouts/PlatformLayout.tsx");
  assert.match(layout, /data-ui="platform-bottom-nav"/);
  assert.match(layout, /md:hidden/);
  assert.match(layout, /hidden w-full min-w-0 max-w-\[1280px\][^"]*md:flex/);
  // max-w-md resolves to --spacing-md (24px) in this theme
  assert.doesNotMatch(layout, /max-w-md\b/);
});

test("organization cards: translated status, compact phone actions, lifecycle behind «Más»", () => {
  const page = read("src/pages/platform/PlatformOrganizationsPage.tsx");
  assert.match(page, /active: \{ label: "Activa"/);
  assert.match(page, /suspended: \{ label: "Suspendida"/);
  assert.match(page, /data-ui="org-card"/);
  assert.match(page, /label=\{`Más acciones para \$\{org\.name\}`\}/);
  assert.match(page, /sheetOnMobile wide open=\{selectedOrg !== null\}/);
});

test("pilot switches only open the audited confirmation (reason required); they never save on tap", () => {
  const card = read("src/features/platform/OrganizationFeaturesCard.tsx");
  assert.match(card, /role="switch" aria-checked=\{f\.enabled\}/);
  assert.match(card, /onClick=\{\(\) => \{ setEditing\(/);
  assert.match(card, /disabled=\{saving \|\| reason\.trim\(\)\.length < 3\}/);
  assert.equal((card.match(/setOrganizationFeature\(/g) ?? []).length, 1);
});

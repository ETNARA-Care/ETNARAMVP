// 28-nov-2026: la franja «Entorno de demostración» (DEMO_ENVIRONMENT) no se superpone a las barras fijas de los portales.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const banner = read("src/components/DemoEnvironmentBanner.tsx");
const css = read("src/styles/tokens.css");

test("franja: altura fija de una línea, por encima de las barras y marcada para el CSS", () => {
  assert.match(banner, /data-demo-banner/);
  assert.match(banner, /sticky top-0 z-\[calc\(var\(--z-header\)\+1\)\]/);
  assert.match(banner, /h-\[var\(--demo-banner-h\)\]/);
  assert.match(banner, /<span className="truncate">\{t\("demoBanner"\)\}<\/span>/);
  assert.match(banner, /if \(!isDemoEnvironment\(activeOrganization\?\.features\)\) return null;/);
});

test("desplazamiento: 0 sin franja; su altura solo cuando la franja existe", () => {
  assert.match(css, /:root \{ --demo-banner-h: 2\.25rem; --demo-banner-offset: 0px; \}/);
  assert.match(css, /html:has\(\[data-demo-banner\]\) \{ --demo-banner-offset: var\(--demo-banner-h\); \}/);
});

test("las barras fijas de los tres portales con franja se colocan justo debajo", () => {
  for (const f of ["src/layouts/admin/AdminTopbar.tsx", "src/layouts/CaregiverLayout.tsx", "src/layouts/FamilyLayout.tsx"])
    assert.match(read(f), /<header className="sticky top-\[var\(--demo-banner-offset\)\]/, f);
  assert.match(read("src/layouts/admin/AdminSidebar.tsx"), /<aside className="sticky top-\[var\(--demo-banner-offset\)\] hidden h-\[calc\(100dvh-var\(--demo-banner-offset\)\)\]/);
  // Ninguna barra de esos portales sigue anclada a top-0 (la de Central no muestra la franja y no cambia).
  for (const f of ["src/layouts/admin/AdminTopbar.tsx", "src/layouts/admin/AdminSidebar.tsx", "src/layouts/CaregiverLayout.tsx", "src/layouts/FamilyLayout.tsx"])
    assert.doesNotMatch(read(f), /className="sticky top-0/, f);
});

// Logo de factura: el portal acepta lo mismo que el backend (PNG, JPEG o WebP, hasta 5 MB).
// El servidor lo convierte en un PNG optimizado de hasta 800 px; el original no se guarda.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("el límite del portal es 5 MB, igual que el backend", () => {
  const src = read("src/features/billing/BillingSettingsSection.tsx");
  assert.match(src, /const LOGO_MAX_BYTES = 5 \* 1024 \* 1024;/);
  assert.doesNotMatch(src, /300 \* 1024/);
});

test("acepta PNG, JPEG y WebP", () => {
  const src = read("src/features/billing/BillingSettingsSection.tsx");
  assert.match(src, /LOGO_TYPES = \["image\/png", "image\/jpeg", "image\/webp"\]/);
  assert.match(src, /accept="image\/png,image\/jpeg,image\/webp"/);
});

test("los textos dicen 5 MB en español e inglés y cubren el logo demasiado pequeño", () => {
  for (const lang of ["es", "en"]) {
    const j = JSON.parse(read(`src/i18n/locales/${lang}/billing.json`));
    assert.match(j.settings.logoHint, /5 MB/, lang);
    assert.match(j.errors.LOGO_TOO_LARGE, /5 MB/, lang);
    assert.match(j.errors.LOGO_TYPE_NOT_ALLOWED, /WebP/, lang);
    assert.ok(j.errors.LOGO_TOO_SMALL, lang);
    assert.doesNotMatch(JSON.stringify(j), /300 KB/, lang);
  }
});

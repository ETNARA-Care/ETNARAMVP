import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const es = JSON.parse(read("src/i18n/locales/es/billing.json"));
const en = JSON.parse(read("src/i18n/locales/en/billing.json"));

test("logo uploader: PNG, JPG and WebP up to 5 MB, checked in the phone before uploading", () => {
  const u = read("src/components/LogoUploader.tsx");
  assert.match(u, /LOGO_ACCEPT = "image\/png,image\/jpeg,image\/webp"/);
  assert.match(u, /LOGO_MAX_BYTES = 5 \* 1024 \* 1024/);
  assert.match(u, /file\.type \? ALLOWED_TYPES\.includes\(file\.type\.toLowerCase\(\)\) : ALLOWED_EXT\.test\(file\.name\)/); // iPhone files without a type
  assert.match(u, /if \(file\.size > LOGO_MAX_BYTES\) return \{ ok: false, reason: "size" \}/);
  assert.doesNotMatch(u, /300 \* 1024/);
  assert.doesNotMatch(read("src/features/billing/BillingSettingsSection.tsx"), /300 \* 1024|LOGO_MAX_BYTES/);
});

test("the preview is the server copy read with the session; the file input is reset after every attempt", () => {
  const u = read("src/components/LogoUploader.tsx");
  assert.match(u, /if \(inputRef\.current\) inputRef\.current\.value = ""/);
  assert.doesNotMatch(u, /createObjectURL|FileReader/); // no local copy shown as if it were saved
  assert.match(read("src/api/billing.ts"), /file\.type \|\| "application\/octet-stream"/);
});

test("messages: 5 MB, accepted types, optimisation and every server code, in Spanish and English", () => {
  for (const [lang, d] of [["es", es], ["en", en]]) {
    for (const k of ["LOGO_TOO_LARGE", "LOGO_TYPE_NOT_ALLOWED", "LOGO_UNREADABLE", "LOGO_EMPTY", "LOGO_TOO_SMALL", "LOGO_BUSY"]) assert.ok(d.errors[k], `${lang} errors.${k}`);
    for (const k of ["logoHint", "logoUploading", "logoTooLargeSize", "logoSavedDetail"]) assert.ok(d.settings[k], `${lang} settings.${k}`);
    assert.match(d.settings.logoHint, /5 MB/);
    assert.match(d.settings.logoHint, /WebP/);
    assert.match(d.errors.LOGO_TOO_LARGE, /5 MB/);
    assert.doesNotMatch(JSON.stringify(d), /300 KB/);
    assert.match(d.settings.logoTooLargeSize, /\{\{size\}\}/);
    assert.match(d.settings.logoSavedDetail, /\{\{width\}\}.*\{\{height\}\}.*\{\{size\}\}/);
  }
});

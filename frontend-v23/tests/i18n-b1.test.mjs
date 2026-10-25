import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { fromBrowser, initialLanguage, isLanguage, LOCALE_TAG } from "../src/i18n/language.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const catalog = (lang, ns) => JSON.parse(read(`../src/i18n/locales/${lang}/${ns}.json`));
const flatten = (obj, prefix = "") => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const namespaces = readdirSync(new URL("../src/i18n/locales/es/", import.meta.url)).map((f) => f.replace(/\.json$/, ""));

test("first visit: English only when the browser prefers English; Spanish otherwise", () => {
  assert.equal(fromBrowser(["en-US", "es-PR"]), "en");
  assert.equal(fromBrowser(["es-PR", "en-US"]), "es");
  assert.equal(fromBrowser(["fr-FR", "en-GB"]), "en");
  assert.equal(fromBrowser(["fr-FR", "de-DE"]), "es");
  assert.equal(fromBrowser([]), "es");
  assert.equal(fromBrowser(undefined), "es");
});

test("a saved choice wins over the browser; anything invalid is ignored", () => {
  assert.equal(initialLanguage("es", ["en-US"]), "es");
  assert.equal(initialLanguage("en", ["es-PR"]), "en");
  assert.equal(initialLanguage("fr", ["es-PR"]), "es");
  assert.equal(initialLanguage(null, ["en-US"]), "en");
  assert.equal(isLanguage("EN"), false);
  assert.deepEqual(LOCALE_TAG, { es: "es-PR", en: "en-US" });
});

test("both languages have exactly the same keys, none empty, same {{placeholders}}", () => {
  assert.deepEqual(readdirSync(new URL("../src/i18n/locales/en/", import.meta.url)).sort(), readdirSync(new URL("../src/i18n/locales/es/", import.meta.url)).sort());
  for (const ns of namespaces) {
    const es = new Map(flatten(catalog("es", ns)));
    const en = new Map(flatten(catalog("en", ns)));
    assert.deepEqual([...en.keys()].sort(), [...es.keys()].sort(), `keys differ in ${ns}`);
    for (const [key, value] of es) {
      assert.ok(typeof value === "string" && value.trim(), `${ns}:${key} empty in es`);
      assert.ok(typeof en.get(key) === "string" && en.get(key).trim(), `${ns}:${key} empty in en`);
      const ph = (s) => (s.match(/{{\w+}}/g) ?? []).sort().join();
      assert.equal(ph(en.get(key)), ph(value), `${ns}:${key} placeholders`);
    }
  }
  const index = read("../src/i18n/index.ts");
  for (const ns of namespaces) assert.match(index, new RegExp(`\\b${ns}\\b`), `${ns} not registered`);
});

test("Spanish is the default and the fallback; first paint already translated", () => {
  const index = read("../src/i18n/index.ts");
  assert.match(index, /fallbackLng: DEFAULT_LANGUAGE/);
  assert.match(read("../src/i18n/language.ts"), /export const DEFAULT_LANGUAGE: Language = "es";/);
  assert.match(index, /initAsync: false/);
  assert.match(read("../src/main.tsx"), /import "@\/i18n";[^\n]*\nimport App from "\.\/App";/);
});

test("the login screen has no hard-coded text left and every key it uses exists", () => {
  const page = read("../src/pages/LoginPage.tsx");
  const jsxText = [...page.matchAll(/>\s*([^<>{}\n]*[A-Za-zÁÉÍÓÚáéíóúñ¿¡][^<>{}\n]*)\s*</g)].map((m) => m[1].trim()).filter(Boolean);
  assert.deepEqual(jsxText, []);
  assert.doesNotMatch(page, /label="[^"]+"/);
  const auth = new Map(flatten(catalog("es", "auth")));
  for (const [, key] of page.matchAll(/\bt\("([\w.]+)"/g)) assert.ok(auth.has(key) || key === "appName", `missing auth:${key}`);
  const messages = read("../src/auth/errorMessages.ts");
  for (const [, key] of messages.matchAll(/i18n\.t\("auth:([\w.]+)"\)/g)) assert.ok(auth.has(key), `missing auth:${key}`);
  assert.doesNotMatch(messages, /return "/);
});

test("the selector: two buttons, pressed state, accessible names, no reload", () => {
  const sw = read("../src/features/i18n/LanguageSwitcher.tsx");
  assert.match(sw, /aria-pressed=\{selected\}/);
  assert.match(sw, /role="group" aria-label=\{t\("language\.label"\)\}/);
  assert.doesNotMatch(sw, /location\.reload|window\.location/);
});

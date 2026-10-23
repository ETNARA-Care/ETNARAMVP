import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const agencyFiles = readdirSync(new URL("../src/pages/agency/", import.meta.url))
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => [name, read(`src/pages/agency/${name}`)]);

// Text a person can read: JSX text and string literals, not identifiers or imports.
const visibleText = (source) => [
  ...source.matchAll(/>([^<>{}();=]+)</g),
  ...source.matchAll(/"([^"\n]*)"/g),
].map((match) => match[1]).filter((text) => !text.startsWith("@/") && !text.startsWith("./"));

test("agency screens do not show internal jargon", () => {
  for (const [name, source] of agencyFiles) {
    for (const text of visibleText(source)) {
      assert.doesNotMatch(text, /\bB2B\b|endpoint|[Bb]riefing/, `${name}: "${text}"`);
    }
  }
  const center = read("src/pages/agency/AgencyAgentCenterPage.tsx");
  assert.match(center, /Áreas de ETNARA/);
  assert.match(center, /La familia no participa en estos análisis/);
});

test("agency screens use real plurals instead of (s)", () => {
  for (const [name, source] of agencyFiles) {
    assert.doesNotMatch(source, /[a-záéíóúñ]\((s|es)\)\s/, name);
  }
});

test("agency dates do not show seconds", () => {
  for (const [name, source] of agencyFiles) {
    assert.doesNotMatch(source, /toLocaleString\("es-PR"\)/, name);
  }
});

test("hours and billing warns about missing rates", () => {
  const page = read("src/pages/agency/AgencyTimesheetsPage.tsx");
  assert.match(page, /r\.pay_rate_cents==null\|\|r\.bill_rate_cents==null/);
  assert.match(page, /Falta la tarifa de \$\{list\}/);
  assert.match(page, /Sin tarifa, el pago y la facturación de esas horas salen en \$0\./);
  assert.match(page, /Poner tarifa/);
  assert.match(page, /Falta tarifa/);
});

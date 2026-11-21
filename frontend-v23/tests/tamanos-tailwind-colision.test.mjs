// En este proyecto el tema define --spacing-3xs…2xl. Tailwind v4 resuelve entonces los anchos con nombre (max-w-«xs», w-«md»…) con
// esos espaciados (0,75 rem, 1,5 rem…) y no con los anchos de contenedor: un campo así mide 12 px.
// (Caso real: el código de verificación de la firma en iPhone, 21-nov-2026.) Usar valores explícitos: max-w-[20rem].
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../src/", import.meta.url).pathname;
const tokens = readFileSync(join(root, "styles/tokens.css"), "utf8");
const names = [...tokens.matchAll(/--spacing-([a-z0-9]+):/g)].map((m) => m[1]);
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : []; });

test("el tema define espaciados con nombre (la colisión es posible)", () => {
  assert.ok(names.includes("xs") && names.includes("md"), names.join(","));
});

test("ninguna clase de ancho/alto usa un nombre de espaciado del tema", () => {
  const re = new RegExp(`(?<![\\w-])(?:[a-z]+:)*(max-w|min-w|w|max-h|min-h|h|size)-(${names.join("|")})(?![\\w-])`, "g");
  const hits = files(root).flatMap((f) => [...readFileSync(f, "utf8").matchAll(re)].map((m) => `${f.replace(root, "")}: ${m[0]}`));
  assert.deepEqual(hits, []);
});

test("el campo del código de firma tiene ancho explícito, acepta pegar y mantiene la validación", () => {
  const page = readFileSync(join(root, "pages/agency/AgencyContractDetailPage.tsx"), "utf8");
  assert.match(page, /<div className="w-full max-w-\[20rem\]" data-testid="code-field">/);
  assert.match(page, /setCode\(e\.target\.value\.replace\(\/\\D\/g, ""\)\.slice\(0, 6\)\)/);
  assert.match(page, /autoComplete="one-time-code"/);
  assert.match(page, /disabled=\{!validCode\(code\) \|\| secondsLeft === 0\}/);
  const input = page.slice(page.indexOf('label="Código de verificación"'), page.indexOf('data-testid="code-input"'));
  assert.doesNotMatch(input, /maxLength/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Incident 24-oct-2026: in Finanzas › Servicio › Simulador (navy card, text-white)
// the Duración, Fecha, Cliente and Cuidador/a fields showed white text on a
// white field. Cause: fieldBase had `text-[var(--text-body)]`; Tailwind compiles
// that as `color: var(--text-body)` (= 0.9375rem, a length), emitted after the
// real color utility. An invalid color falls back to the inherited one, so every
// field inherited its container's color. On iPhone the date field also pushed
// past the card: the grid cells kept min-width:auto.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const form = read("src/components/ui/Form.tsx");
const fieldBase = /const fieldBase =([\s\S]*?);/.exec(form)?.[1] ?? "";
const detail = read("src/features/finance/ServiceDetail.tsx");
const simulator = detail.slice(detail.indexOf("function Simulator("));

test("form fields: no size token written as a colour utility", () => {
  assert.ok(fieldBase, "fieldBase found");
  assert.doesNotMatch(fieldBase, /text-\[var\(--text-[a-z0-9-]+\)\]/, "text-[var(--text-*)] compiles to color:, not font-size");
});

test("form fields: text colour is set explicitly, not inherited from the container", () => {
  assert.match(fieldBase, /text-\[var\(--color-text-primary\)\]/);
  assert.match(fieldBase, /bg-\[var\(--color-surface\)\]/);
});

test("simulator: grid cells and the date field can shrink on narrow phones", () => {
  assert.match(simulator, /<div className="grid grid-cols-2 gap-3 \[&_label\]:text-white\/80 \[&>\*\]:min-w-0">/);
  assert.match(simulator, /<Input label="Fecha del servicio" type="date" className="min-w-0 appearance-none" value=\{date\}/);
});

test("simulator: business logic untouched (same request to the resolver)", () => {
  assert.match(simulator, /financeApi\.resolve\(organizationId, \{ serviceId, date, billingClientId: clientId \|\| undefined, membershipId: membershipId \|\| undefined, minutes \}, token\)/);
  assert.match(simulator, /const match = \/\^\(\\d\{1,3\}\)\(\?:\\\.\(\\d\{1,2\}\)\)\?\$\/\.exec\(minutesText\);/);
});

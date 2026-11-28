import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// 181 (28-nov-2026): vínculo con ETNARA Connect. Solo la administración, nunca hogares; el código no se guarda en el
// navegador; con la integración apagada (404) la tarjeta no aparece; desvincular pide confirmación.
test("181: the Connect card is admin-only, hidden for homes and when the integration is off", () => {
  const page = read("src/pages/agency/AgencyOrganizationSettingsPage.tsx");
  assert.match(page, /\{isOrgAdmin && organizationId && !residential && <ConnectLinkCard organizationId=\{organizationId\} \/>\}/);
  const card = read("src/features/connect/ConnectLinkCard.tsx");
  assert.match(card, /status === 404 \? "hidden"/);
  assert.match(card, /if \(state === "hidden"\) return null;/);
  assert.doesNotMatch(card, /localStorage|sessionStorage|indexedDB/i);
  assert.match(card, /title="¿Desvincular ETNARA Connect\?"/);
});

test("181: the API client only uses the 181 organization routes (never the service-to-service ones)", () => {
  const api = read("src/api/connect.ts");
  for (const r of ["/connect`", "/connect/link-code`", "/connect/unlink`"]) assert.ok(api.includes(r), r);
  assert.doesNotMatch(api, /integrations\/connect/);
});

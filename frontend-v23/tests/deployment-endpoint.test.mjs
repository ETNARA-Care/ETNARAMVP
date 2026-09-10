import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activeBackend = "https://etnara-care-backend-staging-production-2a3a.up.railway.app";

test("CI and Pages build against the active Railway backend", async () => {
  const [ci, deploy] = await Promise.all([
    readFile(new URL("../../.github/workflows/etnara-frontend-ci.yml", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8"),
  ]);

  assert.match(ci, new RegExp(`VITE_API_URL: ${activeBackend}`));
  assert.match(deploy, new RegExp(`VITE_API_URL: ${activeBackend}`));
  assert.doesNotMatch(ci, /production-d460/);
  assert.doesNotMatch(deploy, /production-d460/);
});

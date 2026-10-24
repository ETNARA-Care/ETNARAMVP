import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("../src/features/serviceLocation/LocationMapPicker.tsx", import.meta.url), "utf8");

test("map tiles: provider sees only the origin, fewer tiles, OSM stays the default", () => {
  assert.match(src, /referrerPolicy: "strict-origin"/);
  assert.match(src, /keepBuffer: 1, updateWhenIdle: true/);
  assert.match(src, /import\.meta\.env\.VITE_MAP_TILE_URL \|\| "https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png"/);
  assert.match(src, /L\.tileLayer\(TILE_URL, TILE_OPTIONS\)/);
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /geocod|nominatim|search\?q=/i, "the written address is never sent to a map provider");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const api = read("src/api/platformOrganizations.ts");
const page = read("src/pages/platform/PlatformOrganizationsPage.tsx");

// 160 (PR A, 23-nov-2026): tercera modalidad en ETNARA Central, apagada hasta completar los PR A, B y C.
test("Central traduce los tres tipos sin confundir un independiente con un hogar", () => {
  assert.match(api, /INDEPENDENT_PROVIDER: "independent_provider"/);
  assert.match(api, /independent_provider: "INDEPENDENT_PROVIDER"/);
  assert.doesNotMatch(api, /=== "HOME_CARE_AGENCY" \? "agency" : "residential_establishment"/);
  assert.match(page, /independent_provider: "Cuidador independiente"/);
});

test("la opción solo aparece si el backend la declara disponible", () => {
  assert.match(api, /"\/platform\/organization-types"/);
  assert.match(api, /filter\(\(t\) => t\.available/);
  assert.match(page, /availableTypes\.includes\("independent_provider"\) \? <option value="independent_provider">Cuidador independiente<\/option> : null/);
  assert.match(page, /useState<PlatformOrganizationType\[\]>\(\["agency", "residential_establishment"\]\)/);
});

test("textos: una sola persona, sin verificación de ETNARA, y errores claros", () => {
  assert.match(page, /data-testid="independent-modality-note"/);
  assert.match(page, /ETNARA Care no verifica ni aprueba sus credenciales\./);
  assert.match(page, /INDEPENDENT_MODALITY_DISABLED/);
  assert.match(page, /INDEPENDENT_SINGLE_OPERATOR/);
  assert.doesNotMatch(page, /verificad[oa] por ETNARA|certificad[oa] por ETNARA/i);
});

import { readFileSync } from "node:fs";
/** i18n (B2): navigation texts live in the shell catalog; these read the Spanish (default) wording. */
const es = JSON.parse(readFileSync(new URL("../src/i18n/locales/es/shell.json", import.meta.url), "utf8"));
const en = JSON.parse(readFileSync(new URL("../src/i18n/locales/en/shell.json", import.meta.url), "utf8"));
const at = (obj, key) => key.split(".").reduce((o, k) => o?.[k], obj);
export const shellEs = (key) => at(es, key);
export const shellEn = (key) => at(en, key);

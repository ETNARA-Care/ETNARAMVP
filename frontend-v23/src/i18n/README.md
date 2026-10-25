# ETNARA Care i18n

- **Languages:** `es` (Spanish of Puerto Rico, `es-PR`, default and fallback) and `en` (`en-US`).
- **Catalogs:** `locales/<language>/<namespace>.json`, one namespace per module. Both languages must have the same keys (a test checks it).
  - B1: `common`, `auth`.
  - Next phases: `agency`, `caregiver`, `family`, `central`, `smartmatch`, `enCamino`, `finance`, `documents`, `incidents`, `notifications`.
  - Add the JSON files and register them in `index.ts` (`resources` and `NAMESPACES`).
- **Keys:** stable and descriptive (`login.submit`), never the Spanish text.
- **Never translate:** what users write, people's names, or API values (codes, roles, statuses, ids). Translate only how they are shown.
- **Dates and numbers:** use `format.ts` (active language, always America/Puerto_Rico time).
- **Choosing the language:**
  - the visitor's choice is saved on the device (`etnara.language`);
  - first visit: the browser language if it is English, otherwise Spanish;
  - per-user preference comes in a later phase.

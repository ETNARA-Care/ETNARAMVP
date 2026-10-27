import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// F1.1 visual (25-oct-2026, iPhone pruebas reales): fecha en el idioma del teléfono,
// nombre de la cuidadora cortado, icono de calendario sobre el texto, tarjetas fuera de la pantalla.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const detail = read("src/features/finance/ServiceDetail.tsx");
const simulator = detail.slice(detail.indexOf("function Simulator("));

test("dates follow the app language (i18n), not the phone: shared i18n helpers, no hard-coded es-PR", () => {
  const money = read("src/features/finance/money.ts");
  assert.match(money, /import \{ currentLanguage \} from "@\/i18n";/);
  assert.match(money, /toLocaleDateString\(LOCALE_TAG\[language\], \{ \.\.\.options, timeZone: "UTC" \}\)/);
  for (const f of ["src/features/finance/money.ts", "src/features/finance/ServiceDetail.tsx", "src/features/finance/HolidaysTab.tsx", "src/features/finance/ShiftFinancePanel.tsx", "src/features/finance/CaregiversTab.tsx"]) {
    assert.doesNotMatch(read(f), /"es-PR"/, f);
  }
  assert.match(detail, /\{formatDateTime\(h\.occurred_at\)\}/);
  assert.match(read("src/pages/agency/AgencyFinancePage.tsx"), /useTranslation\(\);/);
});

test("date fields show the date in the app language and keep the native picker and value", () => {
  const field = read("src/features/finance/DateField.tsx");
  assert.match(field, /const language = i18n\.resolvedLanguage === "en" \? "en" : "es";/);
  assert.match(field, /type="date" lang=\{LOCALE_TAG\[language\]\} value=\{value\}/);
  assert.match(field, /className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0"/);
  assert.match(field, /<CalendarDays size=\{18\} className="shrink-0/);
  for (const f of ["src/features/finance/ServiceDetail.tsx", "src/features/finance/HolidaysTab.tsx"]) {
    assert.doesNotMatch(read(f), /type="date"/, `${f} uses DateField`);
  }
});

test("simulator: caregiver and client get the full width on a phone; the calendar icon has its own column", () => {
  assert.match(simulator, /<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 \[&_label\]:text-white\/80 \[&_p\]:!text-white\/70 \[&>\*\]:min-w-0" data-simulator-people>/);
  assert.match(simulator, /<CalendarClock size=\{14\} className="mt-px shrink-0" aria-hidden \/>/);
  assert.doesNotMatch(simulator, /className="inline"/);
  assert.match(detail, /hint=\{longName\(caregivers\.find\(\(c\) => c\.membership_id === membershipId\)\?\.display_name\)\}/);
});

test("caregiver cards: no horizontal overflow and names wrap instead of being cut", () => {
  const tab = read("src/features/finance/CaregiversTab.tsx");
  assert.match(tab, /grid grid-cols-1 gap-3 lg:grid-cols-2 \[&>li\]:min-w-0/);
  assert.match(tab, /break-words font-medium leading-snug/);
  assert.doesNotMatch(tab, /truncate font-medium/);
  assert.match(read("src/features/finance/ShiftFinancePanel.tsx"), /break-words font-medium">\{data\.effective\.caregiverName/);
});

test("no business change: same resolver request, same API client, same cancel/end calls", () => {
  assert.match(simulator, /financeApi\.resolve\(organizationId, \{ serviceId, date, billingClientId: clientId \|\| undefined, membershipId: membershipId \|\| undefined, minutes \}, token\)/);
  assert.match(detail, /financeApi\.cancelRate\(organizationId, rate\.id, reason\.trim\(\), token\)/);
  assert.match(detail, /financeApi\.endRate\(organizationId, rate\.id, \{ effectiveTo: to, reason: reason\.trim\(\) \}, token\)/);
});

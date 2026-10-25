import { formatDate, formatMoney, formatTime } from "@/i18n/format";
import type { TaxTreatment } from "@/api/billing";

type TFunction = (...args: never[]) => unknown;

/** Facturación F2.2: shared formatting in the app language, Puerto Rico time. */
export type Lang = "es" | "en";
export const langOf = (resolved: string | undefined): Lang => (resolved === "en" ? "en" : "es");

export const money = (cents: number, lang: Lang) => formatMoney(cents / 100, lang);
/** YYYY-MM-DD → "25 oct 2026" (formatted at UTC so the day never shifts). */
export function day(iso: string, lang: Lang) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-US" : "es-PR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}
export const time = (instant: string, lang: Lang) => formatTime(instant, lang);
export const dateTime = (instant: string, lang: Lang) => `${formatDate(instant, lang, { day: "numeric", month: "short" })} ${formatTime(instant, lang)}`;
export function hours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
export const percent = (basisPoints: number, lang: Lang) =>
  `${new Intl.NumberFormat(lang === "en" ? "en-US" : "es-PR", { maximumFractionDigits: 2 }).format(basisPoints / 100)} %`;

/** Dynamic catalog keys (codes from the API) with a safe fallback. */
export function tx(t: TFunction, key: string, fallback: string, options?: Record<string, unknown>): string {
  const f = t as unknown as (k: string, o?: Record<string, unknown>) => string;
  const out = f(key, { defaultValue: "", ...options });
  return out && out !== key ? out : f(fallback, options);
}
export function errorText(t: TFunction, error: unknown): string {
  const code = (error as { code?: string })?.code;
  return code ? tx(t, `errors.${code}`, "errors.generic") : tx(t, "errors.generic", "errors.generic");
}
export function taxLabel(t: TFunction, treatment: TaxTreatment, rate: number | null, lang: Lang) {
  if (treatment === "taxable" && rate != null) return `${tx(t, "tax.treatment.taxable", "tax.treatment.taxable")} ${percent(rate, lang)}`;
  return tx(t, `tax.treatment.${treatment}`, "tax.treatment.pending");
}
/** "7" or "7.5" (%) → basis points; NaN when invalid. */
export function parsePercent(input: string): number {
  const m = /^(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return NaN;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return bp >= 1 && bp <= 5000 ? bp : NaN;
}
/** "25", "25.50", "$1,025.00" → cents; NaN when invalid. */
export function parseMoney(input: string): number {
  const m = /^\$?(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(input.trim().replace(/,(?=\d{3}\b)/g, ""));
  if (!m) return NaN;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
/** "1", "1.5" → hundredths; NaN when invalid. */
export function parseQuantity(input: string): number {
  const m = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return NaN;
  const q = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return q > 0 ? q : NaN;
}

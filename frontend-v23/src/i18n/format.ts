import { LOCALE_TAG, type Language } from "./language";

/**
 * Dates, times, numbers and money in the active language, always in Puerto Rico
 * time. B1 only adds the helpers; screens move to them as they are translated.
 */
const TIME_ZONE = "America/Puerto_Rico";

export function formatDate(value: Date | string, language: Language, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  return new Date(value).toLocaleDateString(LOCALE_TAG[language], { timeZone: TIME_ZONE, ...options });
}

export function formatTime(value: Date | string, language: Language): string {
  return new Date(value).toLocaleTimeString(LOCALE_TAG[language], { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
}

export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE_TAG[language], options).format(value);
}

export function formatMoney(value: number, language: Language): string {
  return new Intl.NumberFormat(LOCALE_TAG[language], { style: "currency", currency: "USD" }).format(value);
}

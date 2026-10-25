/**
 * Which language the app shows. Pure (no React, no i18next) so it can be tested alone.
 *
 * - Spanish of Puerto Rico is the default and the fallback.
 * - First visit: English only if the browser prefers English; anything else → Spanish.
 * - After the visitor chooses (ES | EN), that choice wins, stored on this device only.
 */
export const LANGUAGES = ["es", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "es";
export const STORAGE_KEY = "etnara.language";

/** BCP 47 tag for <html lang>, dates and numbers. */
export const LOCALE_TAG: Record<Language, string> = { es: "es-PR", en: "en-US" };

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/** First browser language that we support; Spanish otherwise. */
export function fromBrowser(preferred: readonly string[] | undefined): Language {
  for (const tag of preferred ?? []) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "es") return "es";
    if (base === "en") return "en";
  }
  return DEFAULT_LANGUAGE;
}

/** Saved choice first, then the browser, then Spanish. */
export function initialLanguage(saved: unknown, preferred: readonly string[] | undefined): Language {
  return isLanguage(saved) ? saved : fromBrowser(preferred);
}

export function readSavedLanguage(): Language | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null; // private mode / blocked storage: just use the browser language
  }
}

export function saveLanguage(language: Language): void {
  try { window.localStorage.setItem(STORAGE_KEY, language); } catch { /* not persisted on this device */ }
}

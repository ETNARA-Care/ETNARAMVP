import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import esCommon from "./locales/es/common.json";
import esAuth from "./locales/es/auth.json";
import esShell from "./locales/es/shell.json";
import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import enShell from "./locales/en/shell.json";
import { DEFAULT_LANGUAGE, LANGUAGES, LOCALE_TAG, initialLanguage, readSavedLanguage, saveLanguage, type Language } from "./language";

/**
 * ETNARA Care i18n (B1). Catalogs live in locales/<language>/<namespace>.json,
 * one namespace per module (see README.md). Spanish (es-PR) is the default and
 * the fallback: a key missing in English shows its Spanish text, never the key.
 * Only how things are SHOWN is translated: API codes, roles, statuses and
 * anything users write stay exactly as they are.
 */
export const resources = {
  es: { common: esCommon, auth: esAuth, shell: esShell },
  en: { common: enCommon, auth: enAuth, shell: enShell },
} as const;
export const NAMESPACES = ["common", "auth", "shell"] as const;

function applyDocumentLanguage(language: Language) {
  if (typeof document !== "undefined") document.documentElement.lang = LOCALE_TAG[language];
}

const start = initialLanguage(readSavedLanguage(), typeof navigator !== "undefined" ? navigator.languages : undefined);

void i18n.use(initReactI18next).init({
  resources,
  lng: start,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...LANGUAGES],
  ns: [...NAMESPACES],
  defaultNS: "common",
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
  initAsync: false, // catalogs are bundled: first paint is already in the right language (no flash)
});
applyDocumentLanguage(start);
i18n.on("languageChanged", (lng) => applyDocumentLanguage(lng === "en" ? "en" : "es"));

/** Switch language now (no reload, no sign-out) and remember it on this device. */
export function setLanguage(language: Language): void {
  saveLanguage(language);
  void i18n.changeLanguage(language);
}

export function currentLanguage(): Language {
  return i18n.resolvedLanguage === "en" ? "en" : "es";
}

export default i18n;
